import React from 'react'
import './App.css'

interface TermsPageProps { onAgree?: () => void }

const TermsPage: React.FC<TermsPageProps> = ({ onAgree }) => {
  const [checked, setChecked] = React.useState(false)
  return (
    <main className="terms-page">
      <div className="terms-shell">
        <header className="terms-header">
          <a className="terms-back" href="/">← Poxey X1</a>
          <span>TERMS & CONDITIONS</span>
          <h1>Terms & Conditions</h1>
          <p>Last updated: September 15, 2026</p>
        </header>

        <section className="terms-card">
          <h2>1. Using Poxey X</h2>
          <p>
            Poxey X provides remote Chrome Sessions that allow you to access and use a Chrome browser through the Poxey X service. By accessing or using Poxey X, you agree to these Terms & Conditions and agree to use the service lawfully and responsibly.
          </p>

          <h2>2. What Poxey X Provides</h2>
          <p>
            Poxey X provides isolated Chrome Sessions that run separately from the device you use to access the service. Poxey X does not control the websites, accounts, content, or services that you access through a Chrome Session.
          </p>

          <h2>3. Free Plan</h2>
          <p>
            The Free plan is currently available at no cost and provides 25 minutes of Chrome Session usage every 24 hours.
          </p>
          <p>
            Free users may have one active Chrome Session at a time and do not receive saved Chrome Sessions. Unused time does not stack or carry over. Leaving a Chrome Session early, refreshing the page, closing the browser, or ending the session does not restore used time.
          </p>

          <h2>4. Free Chrome Session Data</h2>
          <p>
            Free Chrome Sessions are temporary. When you leave or end a Free Chrome Session, the browser data associated with that session is deleted.
          </p>
          <p>
            This may include browser history, cookies, cached data, local browser storage, downloads, and other data created inside the Chrome Session. Users should not rely on a Free Chrome Session to retain browser data after leaving the session.
          </p>
          <p>
            Deleting Chrome Session data from Poxey X does not delete information that may already have been stored by third-party websites or services you used.
          </p>

          <h2>5. Privacy</h2>
          <p>
            Poxey X is designed with privacy in mind. We do not collect your browsing data, and we do not sell your browsing data or personal information to advertisers, data brokers, or other companies.
          </p>
          <p>
            Poxey X is designed so that Free Chrome Session browser data is temporary and deleted when you leave or end the session.
          </p>

          <h2>6. Security</h2>
          <p>
            Poxey X uses technical measures intended to protect Chrome Sessions and keep sessions separated from one another. Sessions use authentication tokens to help prevent unauthorized access.
          </p>
          <p>
            However, no internet-connected service can guarantee that it will never be hacked, attacked, compromised, or affected by a security vulnerability. While we work to protect Poxey X and its users, you should use reasonable caution when entering sensitive information into any internet-connected service.
          </p>

          <h2>7. Future Paid Plans</h2>
          <p>
            Plus, Pro, and Pro Max are planned features and are currently unavailable for purchase. The following descriptions represent planned pricing and features and may change before release.
          </p>
          <ul>
            <li>Plus — $4.99/month, 2 hours of usage every 24 hours, and 2 saved Chrome Sessions.</li>
            <li>Pro — $7.99/month, 4 hours of usage every 24 hours, and 4 saved Chrome Sessions.</li>
            <li>Pro Max — $9.99/month, 9 hours of usage every 24 hours, and 6 saved Chrome Sessions.</li>
          </ul>
          <p>
            No payment is currently required for the Free plan. Pricing, limits, features, and availability of future paid plans may change before they become available.
          </p>

          <h2>8. Chrome Session Limits</h2>
          <p>
            Poxey X may limit the number of Chrome Sessions, connections, or other resources available to a user. You may not attempt to bypass usage limits through multiple accounts, automated systems, modified requests, or other methods.
          </p>

          <h2>9. Acceptable Use</h2>
          <p>
            You agree to use Poxey X lawfully and responsibly. You may not use Poxey X to commit or facilitate illegal activity, fraud, phishing, credential theft, malware distribution, unauthorized access, attacks against systems or networks, or activity intended to disrupt the service or harm other users.
          </p>
          <p>
            You may not use Poxey X to circumvent security controls, access another user's Chrome Session, steal authentication tokens, manipulate usage records, or intentionally interfere with Poxey X infrastructure.
          </p>

          <h2>10. Third-Party Websites</h2>
          <p>
            Chrome Sessions may access websites and services operated by third parties. Those websites have their own terms, privacy policies, security practices, and content policies.
          </p>
          <p>
            You are responsible for complying with the rules of third-party websites and services you use. Poxey X does not guarantee the availability, accuracy, security, or content of third-party websites.
          </p>

          <h2>11. Accounts and Access</h2>
          <p>
            Certain Poxey X features may require authentication or other access controls. You are responsible for protecting any credentials or access information associated with your use of Poxey X.
          </p>
          <p>
            You must not share, sell, transfer, or misuse access credentials in a way that compromises the service or violates these Terms.
          </p>

          <h2>12. Audio</h2>
          <p>
            Poxey X may provide browser audio through a Chrome Session. Audio is designed to remain isolated between Chrome Sessions. Poxey X does not guarantee that audio will always be available, uninterrupted, synchronized, or compatible with every device, browser, website, or media format.
          </p>

          <h2>13. Service Availability</h2>
          <p>
            Poxey X is provided on an as-is and as-available basis. The service may experience maintenance, outages, browser failures, network problems, infrastructure limitations, performance issues, or third-party service interruptions.
          </p>
          <p>
            We may modify, restrict, suspend, or discontinue portions of Poxey X as the service develops.
          </p>

          <h2>14. Performance</h2>
          <p>
            Remote Chrome Session performance depends on network conditions, device capabilities, browser performance, server resources, and other technical factors. Poxey X does not guarantee a specific frame rate, latency, loading speed, audio quality, or video quality.
          </p>

          <h2>15. Downloads and User Content</h2>
          <p>
            You are responsible for anything you download, upload, create, or access through a Chrome Session. You must ensure that your activity and content comply with applicable laws and the terms of any third-party service you use.
          </p>

          <h2>16. Intellectual Property</h2>
          <p>
            Poxey X and its original software, branding, design, graphics, text, logos, and other proprietary materials belong to Poxey X or their respective licensors unless otherwise stated.
          </p>
          <p>
            You may not copy, modify, distribute, sell, reverse engineer, or commercially exploit proprietary Poxey X materials without permission, except where applicable law allows otherwise.
          </p>

          <h2>17. Suspension and Termination</h2>
          <p>
            Poxey X may suspend or terminate access if you violate these Terms, abuse the service, attempt to compromise security, create a significant risk to Poxey X or other users, or if required to do so by law.
          </p>
          <p>
            We may also discontinue the service or individual features at any time.
          </p>

          <h2>18. No Warranty</h2>
          <p>
            To the maximum extent permitted by law, Poxey X is provided without guarantees that the service will always be available, secure, error-free, or compatible with every website, device, browser, video, or audio format.
          </p>
          <p>
            We cannot guarantee that data will never be lost or that Poxey X will never experience a security incident.
          </p>

          <h2>19. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Poxey X and its owners, operators, contributors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or similar damages arising from or related to your use of Poxey X.
          </p>
          <p>
            This includes, where permitted by law, loss of data, loss of access, service interruptions, lost profits, or problems caused by third-party websites or services.
          </p>

          <h2>20. Your Responsibility</h2>
          <p>
            You are responsible for your use of Poxey X and for activity performed through your Chrome Sessions. You are also responsible for protecting accounts, passwords, and information that you choose to enter into third-party websites.
          </p>

          <h2>21. Changes to Poxey X</h2>
          <p>
            We may change, update, add, remove, restrict, or discontinue features of Poxey X at any time. Usage limits, plan features, pricing, availability, and technical requirements may change as the service develops.
          </p>

          <h2>22. Changes to These Terms</h2>
          <p>
            These Terms & Conditions may be updated from time to time. The latest version will be made available through the Poxey X website. Your continued use of Poxey X after changes become effective means you accept the updated Terms.
          </p>

          <h2>23. Governing Law</h2>
          <p>
            These Terms will be governed by applicable law, unless applicable law requires otherwise. Any disputes will be handled in accordance with applicable law.
          </p>

          <h2>24. Severability</h2>
          <p>
            If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will continue to apply to the extent permitted by law.
          </p>

          <h2>25. Entire Agreement</h2>
          <p>
            These Terms constitute the agreement between you and Poxey X regarding your use of the service, except where additional terms or policies expressly apply.
          </p>

          <h2>26. Contact</h2>
          <p>
            For questions about these Terms or Poxey X, use the official support or contact channel provided with the service.
          </p>

          {onAgree && (
            <div className="terms-gate-actions">
              <label className="terms-gate-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                <span>I agree to the Terms & Conditions.</span>
              </label>

              <div className="terms-gate-buttons">
                <a className="terms-gate-cancel" href="/">
                  Cancel
                </a>
                <button type="button" disabled={!checked} onClick={onAgree}>
                  Agree & Launch
                </button>
              </div>
            </div>
          )}

          <div className="terms-footer-note">
            <strong>Poxey X1</strong>
            <span>Your private browser, anywhere.</span>
          </div>
        </section>
      </div>
    </main>
  )
}

export default TermsPage
