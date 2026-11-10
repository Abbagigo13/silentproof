# SilentProof demo video: 1:50 target (hard limit 2:00)

X allows 2:20 for most accounts. Stay under 2:00 so nothing is cut.

## Before you record (10 minutes)

- Use a private window, browser zoom 110 to 125 percent, and hide the extensions bar.
- Two wallets: the organization (`abbagig.testnet`) and any second account for the reporter.
- Have a bounty with money in the pool (a pool of $8 or more is fine). Do not create one on camera.
- Keep the Codespace, Vercel settings, `.env` and terminals OFF screen. Never show a key, a secret or the downloaded key file's contents.
- Do one full dry run first so you know where the waits are. Scoring takes 20 to 60 seconds: cut that wait in editing, or talk over it.
- Record each scene separately if that is easier, then join them.

## Scenes

| Time | On screen | Say (read it naturally, about 150 words a minute) |
|---|---|---|
| 0:00 to 0:12 | Home page, scroll the bounty list | "Whistleblowers risk their jobs, and reward promises are easy to break. SilentProof is a whistleblower bounty marketplace on NEAR: the reward is locked in a contract, and the report stays private." |
| 0:12 to 0:30 | Organization page: Your bounties, show the funded pool and tiers | "An organization posts a bounty and funds it with Circle USDC. The money sits in the contract, so the commitment is public and can't be pulled back before the bounty expires." |
| 0:30 to 0:58 | Switch to the reporter window. Open the bounty, Submit a Report. Type a short report with the word "fraud", enter the payout address, Submit, approve in the wallet. Show the receipt with the IPFS ID | "A reporter writes the report here. It is encrypted in the browser before it leaves the page. Only an encrypted file goes to IPFS, and only its ID and a hash of the payout address go onchain. Nothing readable is stored anywhere." |
| 0:58 to 1:18 | Organization dashboard: the card shows "Awaiting score", then switches to Critical with a percentage | "An AI scorer decrypts the report, rates how severe and credible it is, and signs the result. The contract checks that signature onchain, so the organization can't fake or skip the score." |
| 1:18 to 1:38 | Click Confirm, approve in the wallet. Show Confirmed, the pool dropping, and the USDC arriving (wallet balance or the explorer link) | "The organization confirms, and Circle USDC is paid to the address the reporter chose. If a transfer ever fails, the contract rolls it back automatically." |
| 1:38 to 1:55 | Open the README on GitHub, scroll to "What is not (be aware)", then the repo link | "It runs on NEAR testnet with a Rust contract, NEP-141 USDC and Meteor Wallet. We're honest about the limits: the scorer isn't in a hardware enclave yet, and a wallet pays the network fee. Code and a ten-minute walkthrough are in the repo. Thanks." |

## Recording and editing

- Windows: Win + Alt + R (Xbox Game Bar) or OBS. Mac: Shift + Cmd + 5. Or use Loom.
- Cut the dead time while waiting for wallet popups and scoring. CapCut or Clipchamp is enough.
- Add captions if you can; many people watch without sound.
- Export 1080p MP4 and check the length is under 2:00.

## Post it

Say it was built at NEAR HACKATHON, tag @NEARProtocol and #NEARHackathon, attach the video. Draft text is in `docs/submission.md`.
