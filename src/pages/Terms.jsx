import { LegalPage, Clause, Sub, P, Enum, Defs, Conspicuous, Mail, Ref } from '@/components/legal/LegalPage';
import { EFFECTIVE_DATE, MIN_AGE, TEAM, GOVERNING_STATE } from '@/lib/legal';

const CONTENTS = [
  { id: 'acceptance', title: 'Acceptance of These Terms' },
  { id: 'definitions', title: 'Definitions' },
  { id: 'eligibility', title: 'Eligibility and Minors' },
  { id: 'accounts', title: 'Accounts and Security' },
  { id: 'license', title: 'License to Use the Services' },
  { id: 'content', title: 'Your Content' },
  { id: 'ai', title: 'AI-Generated Output' },
  { id: 'outreach', title: 'Communications with Third Parties' },
  { id: 'conduct', title: 'Prohibited Conduct' },
  { id: 'ip', title: 'Intellectual Property' },
  { id: 'thirdparty', title: 'Third-Party Services' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'term', title: 'Term, Suspension and Termination' },
  { id: 'warranties', title: 'Disclaimer of Warranties' },
  { id: 'liability', title: 'Limitation of Liability' },
  { id: 'indemnity', title: 'Indemnification' },
  { id: 'changes', title: 'Modifications' },
  { id: 'law', title: 'Governing Law and Disputes' },
  { id: 'general', title: 'General Provisions' },
  { id: 'contact', title: 'Contact Information' },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      effective={EFFECTIVE_DATE}
      updated={EFFECTIVE_DATE}
      contents={CONTENTS}
      notice={
        <>
          Please read these terms carefully. Section 7 governs machine-generated output and
          your obligation to verify it. Section 14 disclaims warranties, Section 15 limits our
          liability to you, and Section 18 determines where disputes are resolved.
        </>
      }
      lede={
        <>
          <P>
            These Terms of Service (the “Terms”) form a binding agreement between you and
            Unscripted (“Unscripted,” “we,” “us” or “our”) governing your access to and use of
            the website at useunscripted.base44.app and the services made available through it
            (together, the “Services”).
          </P>
          <P>
            Unscripted is operated by {TEAM} and is not presently organized as a registered legal
            entity. References to “we,” “us” and “our” are to that team. When an operating entity
            is formed, these Terms will be amended to identify it.
          </P>
        </>
      }
    >
      <Clause n="1" id="acceptance" title="Acceptance of These Terms">
        <Sub n="1.1" title="Agreement">
          By creating an account, or by otherwise accessing or using the Services, you agree to
          be bound by these Terms and by the <Ref to="/privacy">Privacy Policy</Ref>, which is
          incorporated into these Terms by reference. If you do not agree to these Terms, you may
          not use the Services.
        </Sub>
        <Sub n="1.2" title="Capacity">
          You represent that you have the legal capacity to enter into these Terms, or that a
          parent or legal guardian has accepted them on your behalf in accordance with Section 3.
        </Sub>
        <Sub n="1.3" title="Summaries">
          Any plain-language summary of these Terms that we may publish is provided for
          convenience only, forms no part of this agreement, and does not modify it.
        </Sub>
      </Clause>

      <Clause n="2" id="definitions" title="Definitions">
        <Defs
          items={[
            {
              term: 'Your Content',
              def: 'means the text, ratings, files and other material you submit to the Services.',
            },
            {
              term: 'Output',
              def: 'means the career paths, experiments, mission guides, outreach drafts, resume text, reflections and other material generated for you by the Services in response to Your Content.',
            },
            {
              term: 'AI Providers',
              def: 'means the third-party providers of large language models used to generate Output, as identified in the Privacy Policy.',
            },
            {
              term: 'Recipient',
              def: 'means any person you contact, or attempt to contact, using material obtained from the Services.',
            },
          ]}
        />
      </Clause>

      <Clause n="3" id="eligibility" title="Eligibility and Minors">
        <Sub n="3.1" title="Minimum age">
          You must be at least {MIN_AGE} years of age to use the Services. The Services are not
          directed to, and may not be used by, any person under {MIN_AGE}.
        </Sub>
        <Sub n="3.2" title="Users aged 13 to 17">
          If you are aged {MIN_AGE} to 17, you may use the Services only if your parent or legal
          guardian has reviewed and agreed to these Terms and permits your use of the Services. By
          using the Services you represent that such permission has been given.
        </Sub>
        <Sub n="3.3" title="Parents and guardians">
          A parent or legal guardian who permits a minor to use the Services thereby agrees to
          these Terms, agrees to supervise that minor’s use of the Services, and accepts
          responsibility for that minor’s conduct on the Services, including any communications
          the minor sends to a Recipient.
        </Sub>
        <Sub n="3.4" title="Accuracy of eligibility representations">
          We may suspend or terminate any account where we reasonably believe the representations
          in this Section are untrue.
        </Sub>
      </Clause>

      <Clause n="4" id="accounts" title="Accounts and Security">
        <Sub n="4.1" title="Registration">
          You agree to provide accurate information when registering and to keep it current. The
          Services generate Output from what you tell them; inaccurate information produces
          unsuitable Output.
        </Sub>
        <Sub n="4.2" title="Credentials">
          You are responsible for maintaining the confidentiality of your credentials and for all
          activity occurring under your account. You agree to notify us at <Mail /> promptly on
          becoming aware of any unauthorized use.
        </Sub>
        <Sub n="4.3" title="One account">
          You may maintain one account. You may not transfer your account to another person.
        </Sub>
      </Clause>

      <Clause n="5" id="license" title="License to Use the Services">
        <Sub n="5.1" title="Grant">
          Subject to your compliance with these Terms, we grant you a limited, revocable,
          non-exclusive, non-transferable, non-sublicensable license to access and use the
          Services for your own personal, non-commercial purposes of career exploration.
        </Sub>
        <Sub n="5.2" title="Reservation">
          All rights not expressly granted are reserved. No right or license is granted by
          implication, estoppel or otherwise.
        </Sub>
      </Clause>

      <Clause n="6" id="content" title="Your Content">
        <Sub n="6.1" title="Ownership">
          You retain all rights you hold in Your Content. These Terms transfer no ownership in
          Your Content to us.
        </Sub>
        <Sub n="6.2" title="License to us">
          You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce,
          display and transmit Your Content, and to transmit it to the AI Providers, solely to the
          extent necessary to operate and provide the Services to you and to comply with law. This
          license terminates when Your Content is deleted, save for copies retained in routine
          backups until overwritten in the ordinary course.
        </Sub>
        <Sub n="6.3" title="Your representations">
          You represent and warrant that you have the rights necessary to submit Your Content and
          that Your Content does not infringe the rights of any person or violate applicable law.
        </Sub>
        <Sub n="6.4" title="Aggregated and de-identified data">
          We may create aggregated or de-identified data from Your Content and use it for any
          lawful purpose, including improving the Services and describing usage. We will not
          attempt to re-identify such data or represent it as attributable to you.
        </Sub>
        <Sub n="6.5" title="Your records">
          The Services are not a system of record. You are responsible for retaining your own
          copies of material you wish to preserve.
        </Sub>
      </Clause>

      <Clause n="7" id="ai" title="AI-Generated Output">
        <Sub n="7.1" title="Nature of the Services">
          The Services generate Output by submitting Your Content, together with instructions
          prepared by us, to the AI Providers, and returning the resulting material to you. Output
          is machine-generated and is not reviewed by a human being before it is presented to you.
        </Sub>
        <Sub n="7.2" title="Output may be inaccurate">
          Output may be inaccurate, incomplete, outdated, internally inconsistent or unsuitable for
          your circumstances. It may state facts that are wrong, including facts concerning
          identified organizations, roles, compensation, requirements, and named individuals, and
          it may present such statements with apparent confidence.
        </Sub>
        <Sub n="7.3" title="Your obligation to verify">
          You are responsible for reviewing and independently verifying Output before relying on
          it or acting on it, and for reviewing every message generated for you before it is sent.
          You must not represent Output as having been prepared or verified by us.
        </Sub>
        <Sub n="7.4" title="No professional advice">
          The Services do not provide career, academic, financial, legal, medical or mental health
          advice, and do not substitute for advice from a qualified professional or from your
          institution’s academic or career advisors.
        </Sub>
        <Sub n="7.5" title="No guarantee of outcome">
          We do not represent or guarantee that use of the Services will result in any employment,
          internship, admission, introduction, response, income or other outcome.
        </Sub>
        <Sub n="7.6" title="Similar Output">
          Output is generated probabilistically. Output provided to you may be similar or
          identical to Output provided to other users, and we make no representation that Output
          is original or capable of protection.
        </Sub>
      </Clause>

      <Clause n="8" id="outreach" title="Communications with Third Parties">
        <P>
          The Services generate drafts intended to be sent by you to real people. In connection
          with any such communication, you agree that you will:
        </P>
        <Enum
          items={[
            'send it from your own account, in your own name, and state truthfully who you are and why you are making contact;',
            'not state or imply that you are affiliated with, endorsed by, employed by or acting on behalf of Unscripted, your institution, or any other person or organization, unless that is true;',
            'not send bulk, repetitive or unsolicited commercial messages, and not use the Services to conduct a mass-contact campaign of any kind;',
            'cease contacting any Recipient who asks you to stop, and honor any opt-out request promptly;',
            'comply with all applicable laws governing electronic communications, including the CAN-SPAM Act, and with any policy of your institution governing contact with its faculty, staff or alumni; and',
            'obtain any Recipient’s contact details by lawful means, and handle them in accordance with Section 3.4 of the Privacy Policy.',
          ]}
        />
        <Sub n="8.1" title="Responsibility">
          Communications you send are your communications. You are solely responsible for their
          content and for their consequences, and we are not a party to them.
        </Sub>
        <Sub n="8.2" title="Enforcement">
          We may suspend or terminate the account of any user who uses the Services to send
          unsolicited bulk messages, to harass a Recipient, or to misrepresent that user’s
          identity or affiliation.
        </Sub>
      </Clause>

      <Clause n="9" id="conduct" title="Prohibited Conduct">
        <P>You may not, and may not permit any other person to:</P>
        <Enum
          items={[
            'access or attempt to access any account, data or portion of the Services that you are not authorized to access, or circumvent any security, authentication or rate-limiting measure;',
            'scrape, crawl, harvest or otherwise extract data from the Services by automated means, or use the Services to build, train or evaluate any competing product or machine-learning model;',
            'resell, sublicense, or make the Services available to any third party, or represent Output as a product of your own making in a commercial context;',
            'submit private information concerning another person without that person’s permission, or submit information you are not permitted to disclose;',
            'submit or generate material that is unlawful, defamatory, harassing, hateful, or sexually explicit, or that sexualizes any minor;',
            'impersonate any person or misrepresent your affiliation with any person or organization; or',
            'interfere with the operation or integrity of the Services, including by transmitting malicious code or imposing an unreasonable load on the infrastructure.',
          ]}
        />
      </Clause>

      <Clause n="10" id="ip" title="Intellectual Property">
        <Sub n="10.1" title="Our rights">
          The Services, including their software, design, text, and the compilation of all
          material within them, are owned by us or our licensors and are protected by intellectual
          property law. “Unscripted,” our logo, and our other marks are our property and may not
          be used without our prior written permission.
        </Sub>
        <Sub n="10.2" title="Third-party marks">
          Any third-party names or marks appearing in the Services are the property of their
          respective owners. Their appearance does not indicate affiliation, sponsorship or
          endorsement, and we make no claim of any relationship with any institution named in the
          Services unless expressly stated.
        </Sub>
        <Sub n="10.3" title="Feedback">
          If you send us suggestions concerning the Services, we may use them without restriction
          and without obligation to you.
        </Sub>
      </Clause>

      <Clause n="11" id="thirdparty" title="Third-Party Services">
        <P>
          The Services are hosted on, and depend on, infrastructure and services operated by third
          parties, and may link to third-party websites. Those services are governed by their own
          terms and privacy policies. We do not control them, do not endorse them, and are not
          responsible for their availability, content or practices.
        </P>
      </Clause>

      <Clause n="12" id="privacy" title="Privacy">
        <P>
          Our treatment of personal information is described in the{' '}
          <Ref to="/privacy">Privacy Policy</Ref>. By using the Services you acknowledge that Your
          Content will be transmitted to the AI Providers as described in that policy and in
          Section 7.1.
        </P>
      </Clause>

      <Clause n="13" id="term" title="Term, Suspension and Termination">
        <Sub n="13.1" title="Term">
          These Terms apply from your first use of the Services and continue until terminated in
          accordance with this Section.
        </Sub>
        <Sub n="13.2" title="Termination by you">
          You may stop using the Services at any time, and may request deletion of your account
          and its contents by writing to <Mail />.
        </Sub>
        <Sub n="13.3" title="Suspension and termination by us">
          We may suspend or terminate your access to the Services, with or without notice, where
          we reasonably believe you have breached these Terms, where necessary to protect the
          Services or another person, or where required by law. Where we terminate an account for
          breach, we will state the reason unless doing so would create a risk to any person or
          would be unlawful.
        </Sub>
        <Sub n="13.4" title="Discontinuation">
          We may modify or discontinue the Services in whole or in part. If we discontinue the
          Services permanently, we will give account holders reasonable advance notice and a
          reasonable opportunity to export Your Content.
        </Sub>
        <Sub n="13.5" title="Survival">
          Sections 6.4, 7, 10, 11, and 14 to 19 survive termination of these Terms.
        </Sub>
      </Clause>

      <Clause n="14" id="warranties" title="Disclaimer of Warranties">
        <Conspicuous>
          The services and all output are provided “as is” and “as available,” without warranty of
          any kind. To the fullest extent permitted by law, we disclaim all warranties, express,
          implied and statutory, including the implied warranties of merchantability, fitness for a
          particular purpose, title and non-infringement. We do not warrant that the services will
          be uninterrupted, secure or error-free, that defects will be corrected, or that any
          output is accurate, complete, current, reliable or suitable for any purpose.
        </Conspicuous>
        <P>
          No advice or information obtained by you from us or through the Services creates any
          warranty not expressly stated in these Terms. Some jurisdictions do not allow the
          exclusion of implied warranties, so parts of this Section may not apply to you.
        </P>
      </Clause>

      <Clause n="15" id="liability" title="Limitation of Liability">
        <Conspicuous>
          To the fullest extent permitted by law, we will not be liable for any indirect,
          incidental, special, consequential, exemplary or punitive damages, or for any loss of
          profits, data, goodwill, educational or professional opportunity, however caused and on
          any theory of liability, arising out of or in connection with the services or any output,
          even if we have been advised of the possibility of such damages. Our total aggregate
          liability arising out of or in connection with these terms or the services will not
          exceed the greater of one hundred United States dollars (US $100) or the total amount you
          have paid us in the twelve (12) months preceding the event giving rise to the claim.
        </Conspicuous>
        <Sub n="15.1" title="Decisions you make">
          Without limiting the foregoing, we are not liable for decisions you make concerning your
          education, career or finances, or for the consequences of any communication you send to a
          Recipient.
        </Sub>
        <Sub n="15.2" title="Exceptions">
          Nothing in these Terms excludes or limits liability for fraud or fraudulent
          misrepresentation, for death or personal injury caused by negligence, or for any other
          liability that cannot be excluded or limited under applicable law. Some jurisdictions do
          not allow certain limitations, so parts of this Section may not apply to you.
        </Sub>
        <Sub n="15.3" title="Basis of the bargain">
          The limitations in this Section and in Section 14 are an essential basis of the agreement
          between us and apply notwithstanding the failure of any limited remedy of its essential
          purpose. The Services are provided without charge.
        </Sub>
      </Clause>

      <Clause n="16" id="indemnity" title="Indemnification">
        <P>
          You agree to indemnify and hold us harmless from any claim, demand, loss or expense,
          including reasonable legal fees, brought by a third party and arising out of (a) Your
          Content, (b) any communication you send to a Recipient, (c) your breach of these Terms or
          of applicable law, or (d) your infringement of the rights of any person. We will notify
          you of any such claim and may participate in its defense at our own expense. This Section
          does not apply where you are a consumer and applicable law prohibits it.
        </P>
      </Clause>

      <Clause n="17" id="changes" title="Modifications">
        <Sub n="17.1" title="Amendment">
          We may amend these Terms from time to time. The Last Updated date states when they were
          most recently amended.
        </Sub>
        <Sub n="17.2" title="Notice">
          Where an amendment is material, we will give account holders notice before it takes
          effect. Your continued use of the Services after the effective date of an amendment
          constitutes acceptance of the amended Terms. If you do not accept them, you must stop
          using the Services and may request deletion of your account.
        </Sub>
      </Clause>

      <Clause n="18" id="law" title="Governing Law and Disputes">
        <Sub n="18.1" title="Informal resolution">
          Before commencing any proceeding, you agree to contact us at <Mail /> with a description
          of the dispute and to allow thirty (30) days for the matter to be resolved informally.
          Most matters are resolved this way.
        </Sub>
        <Sub n="18.2" title="Governing law">
          These Terms and any dispute arising out of them are governed by the laws of the State of{' '}
          {GOVERNING_STATE}, without regard to its conflict of laws principles.
        </Sub>
        <Sub n="18.3" title="Venue">
          The state and federal courts located in {GOVERNING_STATE} have exclusive jurisdiction over
          any dispute not resolved informally, and you and we consent to personal jurisdiction
          there. If you are a consumer resident in a jurisdiction whose law entitles you to bring
          proceedings in your local courts or to the protection of its mandatory consumer
          provisions, nothing in this Section deprives you of that entitlement.
        </Sub>
      </Clause>

      <Clause n="19" id="general" title="General Provisions">
        <Sub n="19.1" title="Entire agreement">
          These Terms, together with the Privacy Policy, constitute the entire agreement between
          you and us concerning the Services and supersede all prior understandings concerning
          their subject matter.
        </Sub>
        <Sub n="19.2" title="Severability">
          If any provision of these Terms is held unenforceable, that provision will be enforced to
          the maximum extent permissible and the remaining provisions will remain in full force.
        </Sub>
        <Sub n="19.3" title="No waiver">
          Our failure to enforce any provision is not a waiver of our right to do so later.
        </Sub>
        <Sub n="19.4" title="Assignment">
          You may not assign these Terms without our prior written consent. We may assign them in
          connection with a merger, acquisition or sale of assets.
        </Sub>
        <Sub n="19.5" title="Notices">
          We may give notice to you by email to the address associated with your account or by
          posting to the Services. You may give notice to us at <Mail />.
        </Sub>
        <Sub n="19.6" title="No third-party beneficiaries">
          These Terms confer no rights on any person other than you and us.
        </Sub>
        <Sub n="19.7" title="Relationship">
          Nothing in these Terms creates a partnership, joint venture, employment or agency
          relationship between you and us.
        </Sub>
        <Sub n="19.8" title="Headings">
          Headings are for convenience only and do not affect interpretation.
        </Sub>
      </Clause>

      <Clause n="20" id="contact" title="Contact Information">
        <P>
          Notices, questions and requests concerning these Terms should be sent to <Mail />.
        </P>
      </Clause>
    </LegalPage>
  );
}
