/*!
 * SilentProof — Anonymous Whistleblower Bounty Marketplace
 *
 * NEAR Smart Contract (Rust, NEAR SDK v5)
 *
 * Tracks: AI Security & Defense + Real-World Money
 * NEAR Hackathon 2026
 *
 * Architecture:
 *   - Orgs post USDC-funded bounties with tiered payouts
 *   - Submitters file reports (IPFS CID only — no plaintext ever on-chain)
 *   - A TEE-attested AI scorer writes severity + credibility on-chain
 *   - Orgs confirm payout (releases USDC) or reject (returns to pool)
 *
 * NEAR primitives used:
 *   - Function Call Keys: TEE agent holds a key scoped only to record_tee_score
 *   - NEP-141 USDC: all payouts in USDC fungible token
 *   - Named accounts: org identity is a human-readable NEAR account
 *   - Meta transactions: submit_report can be relayed for full submitter anonymity
 */

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, ext_contract, near_bindgen, require, AccountId, Gas, NearToken, PanicOnDefault,
    Promise, PromiseOrValue,
};

// ─── Constants ────────────────────────────────────────────────────────────────

/// Gas for cross-contract USDC ft_transfer call
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(10);

/// USDC NEP-141 contract on NEAR testnet
/// Mainnet: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
/// Testnet: use Circle's USDC testnet contract or a mock
const USDC_TESTNET: &str = "usdc.fakes.testnet";

/// Yoctoswap: 1 USDC in NEP-141 = 1_000_000 units (6 decimals)
const USDC_DECIMALS: u128 = 1_000_000;

/// Minimum bounty pool: 10 USDC
const MIN_POOL: u128 = 10 * USDC_DECIMALS;

/// Maximum summary hash length (SHA-256 hex = 64 chars)
const MAX_HASH_LEN: usize = 64;

// ─── Types ────────────────────────────────────────────────────────────────────

pub type BountyId = u64;
pub type ReportId = u64;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum BountyCategory {
    Fraud,
    Security,
    Policy,
    Legal,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum SeverityTier {
    Critical,
    High,
    Medium,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum ReportStatus {
    Pending,
    Confirmed,
    Rejected,
}

// ─── Storage structs ──────────────────────────────────────────────────────────

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Bounty {
    pub id: BountyId,
    /// NEAR account of the posting organization
    pub org_account: AccountId,
    pub title: String,
    pub description: String,
    pub category: BountyCategory,
    /// Payout for Critical tier (USDC units, 6 decimals)
    pub tier_critical: U128,
    /// Payout for High tier
    pub tier_high: U128,
    /// Payout for Medium tier
    pub tier_medium: U128,
    /// Remaining USDC in pool (decreases on each confirmed payout)
    pub pool_balance: U128,
    /// Unix timestamp in nanoseconds (NEAR standard)
    pub expiry_ns: u64,
    pub active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Report {
    pub id: ReportId,
    pub bounty_id: BountyId,
    /// IPFS CID of the AES-GCM encrypted report blob — never plaintext
    pub ipfs_cid: String,
    /// SHA-256 hash of the submitter's payout address (not the raw address)
    /// The actual address is held off-chain by the submitter; provided at payout
    pub payout_address_hash: String,
    /// Optional: submitter's NEAR account for on-chain authorship proof
    pub author_account: Option<AccountId>,
    /// Set by TEE scorer via record_tee_score
    pub tee_tier: Option<SeverityTier>,
    /// 0–100 credibility score from TEE AI
    pub tee_score: Option<u8>,
    /// SHA-256 hash of the one-line AI summary (plaintext stays in TEE only)
    pub tee_summary_hash: Option<String>,
    pub status: ReportStatus,
    pub submitted_at_ns: u64,
}

// ─── Cross-contract: NEP-141 USDC ────────────────────────────────────────────

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128>;
}

// ─── Contract state ───────────────────────────────────────────────────────────

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct SilentProof {
    /// Contract owner (can register TEE key, pause contract)
    owner: AccountId,
    /// Registered TEE ECDSA public key (hex-encoded, 65 bytes uncompressed)
    tee_public_key: Option<String>,
    /// All bounties by ID
    bounties: UnorderedMap<BountyId, Bounty>,
    /// All reports by ID
    reports: UnorderedMap<ReportId, Report>,
    /// Index: org_account → list of bounty IDs
    bounties_by_org: LookupMap<AccountId, Vector<BountyId>>,
    /// Index: bounty_id → list of report IDs
    reports_by_bounty: LookupMap<BountyId, Vector<ReportId>>,
    /// Auto-increment counters
    next_bounty_id: BountyId,
    next_report_id: ReportId,
    /// Whether new submissions are accepted (owner can pause)
    paused: bool,
}

// ─── Init ─────────────────────────────────────────────────────────────────────

#[near_bindgen]
impl SilentProof {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");
        Self {
            owner,
            tee_public_key: None,
            bounties: UnorderedMap::new(b"b"),
            reports: UnorderedMap::new(b"r"),
            bounties_by_org: LookupMap::new(b"bo"),
            reports_by_bounty: LookupMap::new(b"rb"),
            next_bounty_id: 0,
            next_report_id: 0,
            paused: false,
        }
    }

    // ─── Owner functions ──────────────────────────────────────────────────────

    /// Register the TEE's ECDSA public key.
    /// Called once by the owner after deploying. The TEE's Function Call Key
    /// is scoped only to record_tee_score — this key is its identity.
    pub fn register_tee_key(&mut self, public_key_hex: String) {
        self.assert_owner();
        require!(
            public_key_hex.len() == 130, // 65 bytes uncompressed, hex = 130 chars
            "TEE public key must be 65 bytes uncompressed (130 hex chars)"
        );
        self.tee_public_key = Some(public_key_hex.clone());
        env::log_str(&format!("TEE key registered: {}...{}", &public_key_hex[..8], &public_key_hex[122..]));
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
        env::log_str(&format!("Contract paused: {}", paused));
    }

    // ─── Bounty management ────────────────────────────────────────────────────

    /// Create a new bounty. The org must fund it immediately after via
    /// fund_bounty (ft_transfer_call from USDC contract).
    pub fn create_bounty(
        &mut self,
        title: String,
        description: String,
        category: BountyCategory,
        tier_critical: U128,
        tier_high: U128,
        tier_medium: U128,
        expiry_days: u32,
    ) -> BountyId {
        require!(!self.paused, "Contract is paused");
        require!(title.len() >= 5 && title.len() <= 100, "Title must be 5–100 chars");
        require!(description.len() <= 1000, "Description max 1000 chars");
        require!(expiry_days >= 1 && expiry_days <= 365, "Expiry must be 1–365 days");
        require!(tier_critical.0 > 0 || tier_high.0 > 0 || tier_medium.0 > 0, "At least one tier must have a payout");
        require!(
            tier_critical.0 >= tier_high.0 && tier_high.0 >= tier_medium.0,
            "Tier amounts must be Critical >= High >= Medium"
        );

        let id = self.next_bounty_id;
        self.next_bounty_id += 1;

        let expiry_ns = env::block_timestamp() + (expiry_days as u64) * 86_400 * 1_000_000_000;

        let bounty = Bounty {
            id,
            org_account: env::predecessor_account_id(),
            title,
            description,
            category,
            tier_critical,
            tier_high,
            tier_medium,
            pool_balance: U128(0), // funded separately via ft_transfer_call
            expiry_ns,
            active: true,
        };

        self.bounties.insert(&id, &bounty);

        // Register in org index
        let org = env::predecessor_account_id();
        if !self.bounties_by_org.contains_key(&org) {
            self.bounties_by_org.insert(&org, &Vector::new(format!("bo_{}", org).as_bytes()));
        }
        let mut org_bounties = self.bounties_by_org.get(&org).unwrap();
        org_bounties.push(&id);
        self.bounties_by_org.insert(&org, &org_bounties);

        env::log_str(&format!("Bounty created: id={}, org={}", id, env::predecessor_account_id()));
        id
    }

    /// NEP-141 callback: called by the USDC contract when org transfers USDC
    /// to fund a bounty. msg = bounty_id as string.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(
            env::predecessor_account_id().as_str() == USDC_TESTNET,
            "Only USDC contract may call ft_on_transfer"
        );
        require!(amount.0 >= MIN_POOL, "Minimum pool funding is 10 USDC");

        let bounty_id: BountyId = msg.trim().parse().expect("msg must be a valid bounty_id");
        let mut bounty = self.bounties.get(&bounty_id).expect("Bounty not found");

        require!(
            bounty.org_account == sender_id,
            "Only the bounty org may fund this bounty"
        );
        require!(bounty.active, "Bounty is no longer active");

        bounty.pool_balance = U128(bounty.pool_balance.0 + amount.0);
        self.bounties.insert(&bounty_id, &bounty);

        env::log_str(&format!(
            "Bounty {} funded: +{} USDC, pool={}",
            bounty_id, amount.0, bounty.pool_balance.0
        ));

        // Accept all tokens (return 0 = no refund)
        PromiseOrValue::Value(U128(0))
    }

    // ─── Report submission ────────────────────────────────────────────────────

    /// Submit a report. Callable by anyone, including a meta-transaction relayer.
    /// No plaintext ever touches this function — only the IPFS CID of the
    /// encrypted blob and the hash of the submitter's payout address.
    pub fn submit_report(
        &mut self,
        bounty_id: BountyId,
        ipfs_cid: String,
        payout_address_hash: String,
        author_account: Option<AccountId>,
    ) -> ReportId {
        require!(!self.paused, "Contract is paused");
        require!(ipfs_cid.len() >= 10 && ipfs_cid.len() <= 100, "Invalid IPFS CID length");
        require!(
            payout_address_hash.len() == 64,
            "Payout address hash must be SHA-256 hex (64 chars)"
        );

        let bounty = self.bounties.get(&bounty_id).expect("Bounty not found");
        require!(bounty.active, "Bounty is not active");
        require!(
            env::block_timestamp() < bounty.expiry_ns,
            "Bounty has expired"
        );
        require!(bounty.pool_balance.0 > 0, "Bounty pool is empty");

        let id = self.next_report_id;
        self.next_report_id += 1;

        let report = Report {
            id,
            bounty_id,
            ipfs_cid: ipfs_cid.clone(),
            payout_address_hash,
            author_account,
            tee_tier: None,
            tee_score: None,
            tee_summary_hash: None,
            status: ReportStatus::Pending,
            submitted_at_ns: env::block_timestamp(),
        };

        self.reports.insert(&id, &report);

        // Register in bounty index
        if !self.reports_by_bounty.contains_key(&bounty_id) {
            self.reports_by_bounty.insert(&bounty_id, &Vector::new(format!("rb_{}", bounty_id).as_bytes()));
        }
        let mut bounty_reports = self.reports_by_bounty.get(&bounty_id).unwrap();
        bounty_reports.push(&id);
        self.reports_by_bounty.insert(&bounty_id, &bounty_reports);

        env::log_str(&format!(
            "Report submitted: id={}, bounty={}, cid={}",
            id, bounty_id, ipfs_cid
        ));
        id
    }

    // ─── TEE scoring ──────────────────────────────────────────────────────────

    /// Record an AI score from the TEE scorer.
    ///
    /// Access control: the caller must provide a valid ECDSA signature over
    /// (report_id || tier_byte || score || summary_hash) using the registered
    /// TEE public key. This is enforced here via signature verification.
    ///
    /// In production: the TEE holds a Function Call Key scoped only to this
    /// method, providing a second layer of access control at the NEAR protocol
    /// level — the TEE cannot call any other contract function with that key.
    pub fn record_tee_score(
        &mut self,
        report_id: ReportId,
        tier: SeverityTier,
        score: u8,
        summary_hash: String,
        /// Hex-encoded ECDSA signature over keccak256(report_id || tier || score || summary_hash)
        signature_hex: String,
    ) {
        require!(score <= 100, "Score must be 0–100");
        require!(
            summary_hash.len() == MAX_HASH_LEN,
            "Summary hash must be SHA-256 hex (64 chars)"
        );

        // Verify TEE key is registered
        let tee_key = self.tee_public_key.as_ref().expect("TEE key not registered");

        // Build the signed payload: report_id (8 bytes LE) || tier (1 byte) || score (1 byte) || summary_hash (32 bytes)
        let tier_byte: u8 = match tier {
            SeverityTier::Critical => 0,
            SeverityTier::High => 1,
            SeverityTier::Medium => 2,
        };
        let summary_bytes = hex::decode(&summary_hash).expect("Invalid summary_hash hex");
        let mut payload = Vec::with_capacity(8 + 1 + 1 + 32);
        payload.extend_from_slice(&report_id.to_le_bytes());
        payload.push(tier_byte);
        payload.push(score);
        payload.extend_from_slice(&summary_bytes);

        // Verify ECDSA signature using NEAR's host function
        let payload_hash = env::keccak256_array(&payload);
        let sig_bytes = hex::decode(&signature_hex).expect("Invalid signature hex");
        require!(sig_bytes.len() == 65, "Signature must be 65 bytes (r+s+v)");
        let key_bytes = hex::decode(tee_key).expect("Invalid TEE key hex");
        require!(key_bytes.len() == 65, "TEE key must be 65 bytes");

        // NEAR SDK ecrecover: recovers the public key from the signature
        // We verify that the recovered key matches the registered TEE key
        let sig_r_s: [u8; 64] = sig_bytes[..64].try_into().expect("sig slice");
        let sig_v = sig_bytes[64];
        let recovered = env::ecrecover(&payload_hash, &sig_r_s, sig_v, true);
        require!(
            recovered.is_some(),
            "Signature recovery failed — invalid TEE signature"
        );
        let recovered_key = recovered.unwrap();
        require!(
            recovered_key == key_bytes.as_slice(),
            "Signature does not match registered TEE key"
        );

        // Write the score
        let mut report = self.reports.get(&report_id).expect("Report not found");
        require!(
            report.status == ReportStatus::Pending,
            "Report is not in Pending status"
        );
        require!(report.tee_tier.is_none(), "Report already scored");

        report.tee_tier = Some(tier.clone());
        report.tee_score = Some(score);
        report.tee_summary_hash = Some(summary_hash.clone());
        self.reports.insert(&report_id, &report);

        env::log_str(&format!(
            "TEE score recorded: report={}, tier={:?}, score={}, summary_hash={}",
            report_id, tier, score, summary_hash
        ));
    }

    // ─── Org actions ──────────────────────────────────────────────────────────

    /// Confirm a report and release USDC to the submitter's payout address.
    /// The org provides the actual payout address here; the contract verifies
    /// it matches the hash stored at submission time.
    pub fn confirm_payout(
        &mut self,
        report_id: ReportId,
        payout_address: String,
    ) -> Promise {
        let mut report = self.reports.get(&report_id).expect("Report not found");
        let bounty = self.bounties.get(&report.bounty_id).expect("Bounty not found");

        // Only the bounty org can confirm
        require!(
            env::predecessor_account_id() == bounty.org_account,
            "Only the bounty organization may confirm payouts"
        );
        require!(
            report.status == ReportStatus::Pending,
            "Report is not in Pending status"
        );
        require!(report.tee_tier.is_some(), "Report has not been scored by the TEE yet");

        // Verify payout address matches the hash submitted by the reporter
        let addr_hash = hex::encode(env::sha256(payout_address.as_bytes()));
        require!(
            addr_hash == report.payout_address_hash,
            "Payout address does not match the hash on record"
        );

        // Determine payout amount from tier
        let tier = report.tee_tier.as_ref().unwrap();
        let payout_amount = match tier {
            SeverityTier::Critical => bounty.tier_critical.0,
            SeverityTier::High => bounty.tier_high.0,
            SeverityTier::Medium => bounty.tier_medium.0,
        };

        // Update pool balance
        let mut bounty_mut = bounty.clone();
        require!(
            bounty_mut.pool_balance.0 >= payout_amount,
            "Insufficient pool balance for this tier"
        );
        bounty_mut.pool_balance = U128(bounty_mut.pool_balance.0 - payout_amount);
        self.bounties.insert(&report.bounty_id, &bounty_mut);

        // Mark report confirmed — state update BEFORE cross-contract call
        report.status = ReportStatus::Confirmed;
        self.reports.insert(&report_id, &report);

        env::log_str(&format!(
            "Payout confirmed: report={}, amount={}, to={}",
            report_id, payout_amount, payout_address
        ));

        // Transfer USDC to submitter's payout address
        let usdc_contract: AccountId = USDC_TESTNET.parse().unwrap();
        let receiver: AccountId = payout_address.parse().expect("Invalid payout address");

        ext_ft::ext(usdc_contract)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(receiver, U128(payout_amount), Some(format!("SilentProof payout report#{}", report_id)))
    }

    /// Reject a report. USDC stays in the pool.
    pub fn reject_report(&mut self, report_id: ReportId) {
        let mut report = self.reports.get(&report_id).expect("Report not found");
        let bounty = self.bounties.get(&report.bounty_id).expect("Bounty not found");

        require!(
            env::predecessor_account_id() == bounty.org_account,
            "Only the bounty organization may reject reports"
        );
        require!(
            report.status == ReportStatus::Pending,
            "Report is not in Pending status"
        );

        report.status = ReportStatus::Rejected;
        self.reports.insert(&report_id, &report);

        env::log_str(&format!("Report rejected: id={}", report_id));
    }

    /// Withdraw unspent pool funds after bounty expiry.
    pub fn withdraw_bounty(&mut self, bounty_id: BountyId) -> Promise {
        let mut bounty = self.bounties.get(&bounty_id).expect("Bounty not found");

        require!(
            env::predecessor_account_id() == bounty.org_account,
            "Only the bounty organization may withdraw"
        );
        require!(
            env::block_timestamp() >= bounty.expiry_ns,
            "Bounty has not expired yet"
        );
        require!(bounty.pool_balance.0 > 0, "Pool is already empty");

        let withdraw_amount = bounty.pool_balance.0;
        bounty.pool_balance = U128(0);
        bounty.active = false;
        self.bounties.insert(&bounty_id, &bounty);

        env::log_str(&format!(
            "Bounty {} withdrawn: {} USDC returned to org {}",
            bounty_id, withdraw_amount, bounty.org_account
        ));

        let usdc_contract: AccountId = USDC_TESTNET.parse().unwrap();
        ext_ft::ext(usdc_contract)
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(bounty.org_account, U128(withdraw_amount), Some(format!("SilentProof bounty#{} withdrawal", bounty_id)))
    }

    // ─── View functions ───────────────────────────────────────────────────────

    pub fn get_bounty(&self, bounty_id: BountyId) -> Option<Bounty> {
        self.bounties.get(&bounty_id)
    }

    pub fn get_active_bounties(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<Bounty> {
        let from = from_index.unwrap_or(0);
        let lim = limit.unwrap_or(20).min(50);
        self.bounties
            .values()
            .filter(|b| b.active && env::block_timestamp() < b.expiry_ns)
            .skip(from as usize)
            .take(lim as usize)
            .collect()
    }

    pub fn get_bounties_by_org(&self, org_account: AccountId) -> Vec<Bounty> {
        match self.bounties_by_org.get(&org_account) {
            None => vec![],
            Some(ids) => ids
                .iter()
                .filter_map(|id| self.bounties.get(&id))
                .collect(),
        }
    }

    pub fn get_report(&self, report_id: ReportId) -> Option<Report> {
        self.reports.get(&report_id)
    }

    pub fn get_reports_by_bounty(
        &self,
        bounty_id: BountyId,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<Report> {
        let from = from_index.unwrap_or(0);
        let lim = limit.unwrap_or(20).min(50);
        match self.reports_by_bounty.get(&bounty_id) {
            None => vec![],
            Some(ids) => ids
                .iter()
                .skip(from as usize)
                .take(lim as usize)
                .filter_map(|id| self.reports.get(&id))
                .collect(),
        }
    }

    /// Returns reports for all bounties owned by an org — used by org dashboard
    pub fn get_reports_for_org(
        &self,
        org_account: AccountId,
        status_filter: Option<ReportStatus>,
    ) -> Vec<Report> {
        let bounty_ids: Vec<BountyId> = match self.bounties_by_org.get(&org_account) {
            None => return vec![],
            Some(ids) => ids.iter().collect(),
        };

        bounty_ids
            .iter()
            .flat_map(|bid| {
                self.reports_by_bounty
                    .get(bid)
                    .map(|ids| ids.iter().filter_map(|rid| self.reports.get(&rid)).collect::<Vec<_>>())
                    .unwrap_or_default()
            })
            .filter(|r| {
                status_filter.as_ref().map_or(true, |s| &r.status == s)
            })
            .collect()
    }

    pub fn get_contract_info(&self) -> serde_json::Value {
        serde_json::json!({
            "owner": self.owner,
            "tee_key_registered": self.tee_public_key.is_some(),
            "total_bounties": self.next_bounty_id,
            "total_reports": self.next_report_id,
            "paused": self.paused,
            "usdc_contract": USDC_TESTNET,
        })
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only the contract owner may call this function"
        );
    }
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, VMContext};

    fn get_context(predecessor: AccountId) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor)
            .block_timestamp(1_000_000_000_000) // 1000 seconds in ns
            .build()
    }

    fn new_contract() -> SilentProof {
        SilentProof::new(accounts(0)) // accounts(0) = "alice"
    }

    #[test]
    fn test_create_bounty() {
        let context = get_context(accounts(1)); // bob = org
        testing_env!(context);
        let mut contract = new_contract();

        let id = contract.create_bounty(
            "Test Bounty".to_string(),
            "A test bounty for fraud reports".to_string(),
            BountyCategory::Fraud,
            U128(5_000 * 1_000_000),
            U128(1_000 * 1_000_000),
            U128(250 * 1_000_000),
            30,
        );

        assert_eq!(id, 0);
        let bounty = contract.get_bounty(0).unwrap();
        assert_eq!(bounty.title, "Test Bounty");
        assert_eq!(bounty.org_account, accounts(1));
        assert_eq!(bounty.pool_balance.0, 0); // not funded yet
        assert!(bounty.active);
    }

    #[test]
    #[should_panic(expected = "At least one tier must have a payout")]
    fn test_create_bounty_no_tiers() {
        let context = get_context(accounts(1));
        testing_env!(context);
        let mut contract = new_contract();
        contract.create_bounty(
            "Test".to_string(),
            "desc".to_string(),
            BountyCategory::Security,
            U128(0), U128(0), U128(0),
            30,
        );
    }

    #[test]
    #[should_panic(expected = "Tier amounts must be Critical >= High >= Medium")]
    fn test_create_bounty_inverted_tiers() {
        let context = get_context(accounts(1));
        testing_env!(context);
        let mut contract = new_contract();
        contract.create_bounty(
            "Test".to_string(),
            "desc".to_string(),
            BountyCategory::Security,
            U128(100), U128(500), U128(1000), // inverted
            30,
        );
    }

    #[test]
    fn test_submit_report() {
        // Create bounty as org
        let mut context = get_context(accounts(1));
        testing_env!(context.clone());
        let mut contract = new_contract();

        let bounty_id = contract.create_bounty(
            "Test Bounty".to_string(),
            "desc".to_string(),
            BountyCategory::Fraud,
            U128(5_000_000_000),
            U128(1_000_000_000),
            U128(250_000_000),
            30,
        );

        // Manually set pool balance for testing (simulating ft_on_transfer)
        let mut bounty = contract.get_bounty(bounty_id).unwrap();
        bounty.pool_balance = U128(20_000_000_000);
        contract.bounties.insert(&bounty_id, &bounty);

        // Submit report as anonymous user (accounts(2))
        context = get_context(accounts(2));
        testing_env!(context);

        let report_id = contract.submit_report(
            bounty_id,
            "QmXf7dVj3kP9mNr2tHs8wLqBvEyCz4Ap6nUiRdT5oGk1M".to_string(),
            "a".repeat(64), // fake SHA-256 hash
            None,
        );

        assert_eq!(report_id, 0);
        let report = contract.get_report(0).unwrap();
        assert_eq!(report.bounty_id, bounty_id);
        assert_eq!(report.status, ReportStatus::Pending);
        assert!(report.tee_tier.is_none());
    }

    #[test]
    #[should_panic(expected = "Bounty has expired")]
    fn test_submit_report_expired_bounty() {
        let mut context = get_context(accounts(1));
        testing_env!(context.clone());
        let mut contract = new_contract();

        let bounty_id = contract.create_bounty(
            "Test".to_string(), "desc".to_string(),
            BountyCategory::Fraud,
            U128(5_000_000_000), U128(1_000_000_000), U128(250_000_000),
            1, // 1 day
        );

        let mut bounty = contract.get_bounty(bounty_id).unwrap();
        bounty.pool_balance = U128(20_000_000_000);
        contract.bounties.insert(&bounty_id, &bounty);

        // Fast-forward past expiry
        context = VMContextBuilder::new()
            .predecessor_account_id(accounts(2))
            .block_timestamp(1_000_000_000_000 + 2 * 86_400 * 1_000_000_000) // 2 days later
            .build();
        testing_env!(context);

        contract.submit_report(
            bounty_id,
            "QmXf7dVj3kP9mNr2tHs8wLqBvEyCz4Ap6nUiRdT5oGk1M".to_string(),
            "a".repeat(64),
            None,
        );
    }

    #[test]
    fn test_reject_report() {
        let mut context = get_context(accounts(1));
        testing_env!(context.clone());
        let mut contract = new_contract();

        let bounty_id = contract.create_bounty(
            "Test".to_string(), "desc".to_string(),
            BountyCategory::Fraud,
            U128(5_000_000_000), U128(1_000_000_000), U128(250_000_000),
            30,
        );
        let mut bounty = contract.get_bounty(bounty_id).unwrap();
        bounty.pool_balance = U128(20_000_000_000);
        contract.bounties.insert(&bounty_id, &bounty);

        context = get_context(accounts(2));
        testing_env!(context.clone());
        let report_id = contract.submit_report(
            bounty_id,
            "QmXf7dVj3kP9mNr2tHs8wLqBvEyCz4Ap6nUiRdT5oGk1M".to_string(),
            "a".repeat(64),
            None,
        );

        // Reject as org
        context = get_context(accounts(1));
        testing_env!(context);
        contract.reject_report(report_id);

        let report = contract.get_report(report_id).unwrap();
        assert_eq!(report.status, ReportStatus::Rejected);

        // Pool unchanged
        let bounty = contract.get_bounty(bounty_id).unwrap();
        assert_eq!(bounty.pool_balance.0, 20_000_000_000);
    }

    #[test]
    #[should_panic(expected = "Only the bounty organization may reject reports")]
    fn test_reject_report_wrong_caller() {
        let mut context = get_context(accounts(1));
        testing_env!(context.clone());
        let mut contract = new_contract();

        let bounty_id = contract.create_bounty(
            "Test".to_string(), "desc".to_string(),
            BountyCategory::Fraud,
            U128(5_000_000_000), U128(1_000_000_000), U128(250_000_000),
            30,
        );
        let mut bounty = contract.get_bounty(bounty_id).unwrap();
        bounty.pool_balance = U128(20_000_000_000);
        contract.bounties.insert(&bounty_id, &bounty);

        context = get_context(accounts(2));
        testing_env!(context.clone());
        let report_id = contract.submit_report(
            bounty_id, "QmXf7".to_string(), "a".repeat(64), None,
        );

        // accounts(3) tries to reject — should fail
        context = get_context(accounts(3));
        testing_env!(context);
        contract.reject_report(report_id);
    }

    #[test]
    fn test_register_tee_key() {
        let context = get_context(accounts(0)); // owner = alice
        testing_env!(context);
        let mut contract = new_contract();

        // Valid 65-byte uncompressed key hex (130 chars)
        let fake_key = "04".to_string() + &"ab".repeat(64);
        contract.register_tee_key(fake_key.clone());
        assert_eq!(contract.tee_public_key, Some(fake_key));
    }

    #[test]
    #[should_panic(expected = "Only the contract owner")]
    fn test_register_tee_key_wrong_caller() {
        let context = get_context(accounts(1)); // not owner
        testing_env!(context);
        let mut contract = new_contract();
        contract.register_tee_key("04".to_string() + &"ab".repeat(64));
    }

    #[test]
    fn test_get_active_bounties() {
        let context = get_context(accounts(1));
        testing_env!(context);
        let mut contract = new_contract();

        for i in 0..3 {
            contract.create_bounty(
                format!("Bounty {}", i),
                "desc".to_string(),
                BountyCategory::Fraud,
                U128(5_000_000_000), U128(1_000_000_000), U128(250_000_000),
                30,
            );
        }

        let active = contract.get_active_bounties(None, None);
        assert_eq!(active.len(), 3);
    }
}
