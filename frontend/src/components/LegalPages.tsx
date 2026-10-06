import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

const UPDATED = '6 October 2026';

function Page({ title, intro, children, other }: { title: string; intro: string; children: ReactNode; other: { to: string; label: string } }) {
  const { lang, p } = useLanguage();
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="container">
          <h1>{title}</h1>
          <p>{intro}</p>
          <span className="legal-hero__date">Last updated {UPDATED}</span>
        </div>
      </div>
      <div className="container legal-body">
        {lang !== 'en' && (
          <p className="legal-note" role="note">{p('This page is shown in English only. If anything is unclear, please contact us and we will explain it.')}</p>
        )}
        <p className="legal-note" role="note">
          Sharing Excess is a student project of Uva Wellassa University. This page describes in plain language what the
          site really does. It is not legal advice and is available in English only.
        </p>
        {children}
        <p className="legal-foot">
          Questions? Use the <Link to="/contact">Contact page</Link>. See also: <Link to={other.to}>{other.label}</Link>.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Privacy() {
  return (
    <Page
      title="Privacy Policy"
      intro="What we collect, why, who can see it, and how to get it removed."
      other={{ to: '/terms', label: 'Terms of Use' }}
    >
      <Section title="What we collect">
        <ul>
          <li><strong>Your account:</strong> name, email address and a password. The password is stored only as a one-way hash, so nobody (including us) can read it. Phone number and location are optional.</li>
          <li><strong>Donors:</strong> the food you list (name, quantity, best-before date, place, description), an optional photo, and an optional contact phone and email.</li>
          <li><strong>Recipients:</strong> the food you request, when you need it, and where.</li>
          <li><strong>Feedback:</strong> your comment, star rating and optional photo.</li>
          <li><strong>Events:</strong> which events you joined, and any email address you give to hear about new events.</li>
          <li><strong>Donations:</strong> the donor's name, email, amount and, if the payment provider supplies it, the <em>last four digits</em> of the card. We never see or store full card numbers.</li>
          <li><strong>Contact form:</strong> your name, email and message are sent to our team by email and are <em>not</em> kept in our database.</li>
        </ul>
      </Section>

      <Section title="Who can see it">
        <ul>
          <li><strong>The public</strong> sees live listings (food, quantity, district and town, photos, the donor's name and rating) and NGO profiles and events. Exact addresses, phone numbers and emails are <em>not</em> shown publicly.</li>
          <li><strong>A donor</strong> sees the name of anyone who requests their food. Once the donor <em>accepts</em> a request, that one recipient receives the donor's phone, email and pickup address, and the donor receives the recipient's phone and email, so they can arrange the handover. Nobody else receives them.</li>
          <li><strong>Our admin</strong> can see accounts, listings, reports and feedback in order to approve NGOs, handle reports and keep the service safe. The admin does not check food quality or supervise handovers.</li>
          <li><strong>Ratings</strong> you give or receive after a completed handover are public on the profile, with your first name only.</li>
          <li>We do not sell your data and we do not show advertising.</li>
        </ul>
      </Section>

      <Section title="Photos">
        <p>Every photo you upload is re-processed on our server: it is resized and saved in a standard format, which also removes hidden camera data such as GPS location.</p>
      </Section>

      <Section title="Cookies and storage on your device">
        <p>We use your browser's local storage, not tracking cookies, to keep you signed in and to remember your choices: login token, a copy of your profile, light/dark theme, language, and whether you dismissed a checklist. We use no analytics or advertising trackers. If you install the app on your phone, its files are cached so it opens quickly and works offline for the basic screens.</p>
      </Section>

      <Section title="Other companies involved">
        <ul>
          <li><strong>Gmail (Google)</strong> sends our emails (verification codes, request updates, event announcements).</li>
          <li><strong>OpenStreetMap</strong> supplies the map images, and <strong>Google Fonts</strong> supplies our typefaces. Your browser contacts them directly, so they can see your IP address.</li>
          <li><strong>Cloudinary</strong> stores photos only if the site is configured to use it; otherwise photos stay on our own server.</li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <p>We keep your information while your account exists. You can delete your account yourself at any time in <Link to="/account">Account settings</Link>: your account, listings or requests, feedback, event sign-ups and uploaded photos are then removed. Two things can remain: payment records we may need to keep for accounting, and, in someone else's request history, the plain-text name of a donor who accepted it (replaced by "A former donor" when that request was made on the donor's own listing).</p>
      </Section>

      <Section title="Your choices">
        <ul>
          <li>Change your name, phone number and location any time in <Link to="/account">Account settings</Link>, and change your password there too.</li>
          <li>Delete your account yourself in Account settings, or ask us to correct your data through the Contact page.</li>
          <li>Unsubscribe from event emails by asking us to remove your address.</li>
        </ul>
        <p>We aim to handle personal data in line with Sri Lanka's Personal Data Protection Act, No. 9 of 2022.</p>
      </Section>

      <Section title="How we protect it">
        <p>Connections to the site should use HTTPS; passwords are hashed; every action on your data checks who is asking and whether they are allowed; sign-in and other sensitive actions are rate-limited. No system is perfectly safe - if we learn of a problem affecting your data we will tell you.</p>
      </Section>

      <Section title="Changes">
        <p>If this page changes in a way that matters, we will update the date above and, for big changes, tell signed-in users.</p>
      </Section>
    </Page>
  );
}

export function Terms() {
  return (
    <Page
      title="Terms of Use"
      intro="The ground rules for sharing food safely and fairly."
      other={{ to: '/privacy', label: 'Privacy Policy' }}
    >
      <Section title="What Sharing Excess is">
        <p>Sharing Excess connects people who have surplus food with people and organisations who can use it. We are a matching and coordination service. We do not prepare, store, inspect, transport or deliver food ourselves, and we are not a party to any exchange between a donor and a recipient.</p>
      </Section>

      <Section title="Food safety - please read">
        <ul>
          <li><strong>Donors</strong> must only offer food that is safe to eat, accurately described, and within its best-before date, and must store and package it hygienically. Do not list food that has spoiled, been left unrefrigerated too long, or that you would not eat yourself.</li>
          <li>Listings go live as soon as they are posted: <strong>nobody checks the food before you collect it</strong>, and the donor's safety tick is not a guarantee. Anyone can report a listing and the admin may remove it.</li>
          <li><strong>Recipients</strong> should look at the food, check dates and smell, and decline anything that seems unsafe. Be especially careful with cooked food, meat, fish and dairy.</li>
        </ul>
      </Section>

      <Section title="Your account">
        <ul>
          <li>Give accurate information and keep your password private. You are responsible for what happens under your account.</li>
          <li>Use one account per person or organisation. Pick the right role (donor or recipient).</li>
          <li>Verify your email. We may suspend accounts that look fake or abusive.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <ul>
          <li>No false, misleading or unlawful listings, requests, feedback or messages.</li>
          <li>No selling food through the platform: listings are for giving surplus food away.</li>
          <li>No harassing other users, and no using contact details you receive for anything other than arranging the handover.</li>
          <li>No attempts to break, overload or scrape the service.</li>
        </ul>
      </Section>

      <Section title="Content you add">
        <p>You keep ownership of the text and photos you post, and you allow us to show them on the site for as long as they are live. Only upload photos you took or have the right to use, and avoid including people's faces without their consent. The admin may remove content that breaks these terms.</p>
      </Section>

      <Section title="Availability and liability">
        <p>The service is provided as it is, free of charge, and may be unavailable at times. To the extent the law allows, we are not responsible for the condition of any food, for arrangements between users, or for losses arising from using the site. Nothing here limits rights you have under Sri Lankan law that cannot be limited.</p>
      </Section>

      <Section title="Changes and contact">
        <p>We may update these terms; the date above shows the latest version. Continuing to use the site after a change means you accept it.</p>
      </Section>
    </Page>
  );
}
