# NEAR Hackathon submission: answers to paste

The form accepts one submission per team and it cannot be edited. Fill it in only when the demo post is live.

| Field | Value |
|---|---|
| Project name | SilentProof |
| Team lead | (your name) |
| Email | (your email) |
| Team size | (your choice) |
| Tracks | AI Security & Defense, Real-World Money |
| NEAR wallet address | abbagigo.tg (a mainnet account you control; prizes are paid here) |
| Repository link | https://github.com/Abbagigo13/silentproof |
| Demo post link | (your X post URL) |

## What did you build?

SilentProof is a whistleblower bounty marketplace on NEAR. Organizations post USDC bounties and lock the money in a Rust smart contract, so the reward is a binding, visible commitment. Reporters write a report in the browser; it is encrypted there (AES-GCM-256) before anything leaves the page, and only an encrypted file on IPFS plus a content ID and a hash of the payout address go on NEAR. An AI scorer decrypts the report, rates severity (Critical, High, Medium) and credibility (0 to 100), and records the result on NEAR with a signature the contract verifies using ecrecover, so an organization cannot fake or skip the score. The organization then confirms or rejects; a confirmed report pays Circle USDC to the address the reporter chose, and a failed transfer rolls back automatically. The scorer runs as a serverless function with an access key that can only call record_tee_score. Built on NEAR with Rust, NEP-141 USDC and Meteor Wallet, and live on testnet. Honest limits: the scorer is not yet in a hardware enclave, and submitting needs a wallet to pay the network fee. The README lists these and gives a 10-minute walkthrough.

## Demo post (X)

Needs to say it was built at NEAR HACKATHON, tag @NEARProtocol and #NEARHackathon, and attach the demo video or screenshots.

> Built SilentProof at NEAR HACKATHON with @NEARProtocol #NEARHackathon.
> A whistleblower bounty marketplace: reports are encrypted in your browser, an AI scorer rates severity and signs it onchain, and the org pays out in Circle USDC.
> Live on testnet: https://silentproof-gules.vercel.app
> Code: https://github.com/Abbagigo13/silentproof

## Demo video (60 to 90 seconds)

1. Organization: post a bounty (10 / 5 / 2 USDC) and fund it.
2. Reporter: submit an encrypted report; show the receipt and key file.
3. Organization: the card goes from "Awaiting score" to a signed score.
4. Confirm the payout and show the USDC arriving.
