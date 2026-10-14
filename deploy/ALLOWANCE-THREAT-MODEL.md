# Browser-identity allowance threat model — Phase 4.2

The session manager keys its ledger by the UUID from `poxey-free-id`, verified by
HMAC. It does not demonstrate a binding from that UUID to a verified person or
trusted account. The policy is **25 minutes per signed browser identity per
24-hour window**, not enforceable as an absolute per-person allowance today.

| Action | Existing result / limitation |
|---|---|
| Refresh/end/restart with intact state and the same valid cookie | Recorded consumption persists; no automatic reconnect/new allowance |
| Change UUID/signature, send unsigned/malformed/duplicate cookie | Creation rejected; no silent replacement identity |
| Lose/replace secret or damage/miss ledger | Fail-closed startup/admission; no silent reset |
| Clear the cookie, use private browsing/new profile/browser/device | Cookie absent; after safe admission resumes, another UUID can receive a new allowance |
| Reuse another legitimate cookie | Same browser identity, not proof of a unique person; protect secret/cookie transport |
| Use another person's session token | Production also requires its owning signed cookie, valid Origin and live session; native development is not a public security boundary |
| Many fresh identities in sequence | Capacity limits bound concurrent sessions, not cumulative daily identities |

The Phase 4.1 migration prevents identity resets caused by infrastructure loss.
It does not solve Sybil abuse, prove device uniqueness, or recover unknown usage
from an incomplete backup. Phase 4.2 deliberately leaves this recovery mechanism,
cookie format, window definition and real ledger unchanged.

## Feasible next protections, requiring a separate reviewed policy

- For a small beta, supervised invitation-only admission with a known roster and
  manual abuse handling can limit exposure; the gateway must actually enforce it,
  not simply hide a link. No invitation gate was implemented/enabled this sprint.
- If an existing trusted login is suitable, explicitly bind allowance and admission
  to a server-verified stable account identifier. Review account sharing, logout,
  migration and existing consumption first. Do not assume a platform login already
  does this, change ledger keys silently, or add an unapproved auth provider.
- Durable per-account invitation redemption/concurrency records are another
  possible reviewed design. Tokens must not independently mint unlimited accounts;
  token storage, revocation, loss recovery and accounting migration need approval.
- Request/IP rate limits and global admission budgets can reduce resource abuse,
  but are not identity: NAT/shared networks can group legitimate users, IPv6/VPN
  addresses can change. Tune limits from real tests and avoid treating IP as a
  guaranteed person. No reverse-proxy/Cloudflare/rate-limit change was made here.

Do not use invasive fingerprinting, MAC/user-agent tricks, unsigned cookies,
client-only timers, secret rotation or cookie deletion as enforcement fixes.
No safe, narrow backend edit can turn an anonymous missing cookie into a proven
returning person. Inventing that guarantee would be a security regression.

Release requirement: choose and document an honest beta admission/abuse policy;
retain tamper rejection and fail-closed accounting, then test shared networks,
cookie clearing, private browsing, concurrent launches and account sharing under
the approved policy. Current regressions verify integrity and continuity, not
absolute person uniqueness.
