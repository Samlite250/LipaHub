import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Globe2, ShieldCheck } from 'lucide-react'
import { Logo } from '../components'

function GuidePage({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: ReactNode }) {
  return <main className="document-page guide-page">
    <Logo />
    <section className="panel">
      <div className="document-body">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="guide-lead">{lead}</p>
        {children}
        <div className="guide-actions">
          <Link className="button primary" to="/register">Create your account <ArrowRight size={16} /></Link>
          <Link className="button secondary" to="/">Back to LipaHub</Link>
        </div>
      </div>
    </section>
    <div className="guide-footer">
      <Link to="/about">About</Link>
      <Link to="/east-africa">East Africa</Link>
      <Link to="/online-work">Online work</Link>
      <Link to="/business">Business</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/privacy">Privacy</Link>
    </div>
  </main>
}

export function AboutPage() {
  return <GuidePage eyebrow="ABOUT LIPAHUB" title="A learning and community hub for East Africa" lead="LipaHub brings learning resources, community, digital-skills guidance and transparent product previews into one member space.">
    <h2>What LipaHub is</h2>
    <p>LipaHub is an online learning and community platform designed for people exploring digital opportunities in East Africa. Members can manage a private profile, read published resources and announcements, contact support and explore clearly labelled simulations.</p>
    <p>Our public guides explain online work, digital skills and the questions people should ask before trusting any earning opportunity. LipaHub is not a job board and does not promise employment or guaranteed income.</p>
    <h2>Where LipaHub is available</h2>
    <p>LipaHub is built with Rwanda, Uganda, Kenya and Burundi in mind, while welcoming members from other countries. Country selection helps present relevant payment and learning information when those services are available.</p>
    <h2>What we do not promise</h2>
    <ul className="guide-list">
      <li><CheckCircle2 size={16} /> No guaranteed jobs, salaries or online earnings.</li>
      <li><CheckCircle2 size={16} /> No guaranteed investment or trading returns.</li>
      <li><CheckCircle2 size={16} /> Crypto robotic trading is an educational simulation, not live trading.</li>
      <li><CheckCircle2 size={16} /> Payments and withdrawals remain unavailable until the required providers and reviews are complete.</li>
    </ul>
    <h2>Business and partnerships</h2>
    <p>Organizations interested in learning content, community programmes or future collaboration can read the <Link className="text-link" to="/business">LipaHub Business overview</Link>. Partnerships are not yet open.</p>
    <h2>Contact</h2>
    <p>Questions about LipaHub can be sent to <a className="text-link" href="mailto:lipahubsupport@gmail.com">lipahubsupport@gmail.com</a>.</p>
  </GuidePage>
}

export function EastAfricaPage() {
  return <GuidePage eyebrow="BUILT FOR EAST AFRICA" title="LipaHub in Rwanda, Uganda, Kenya and Burundi" lead="One learning and community hub for members across East Africa, with country-aware content and honest guidance about online opportunities.">
    <h2>One hub, local context</h2>
    <p>People across East Africa search for learning, digital skills, online work and better opportunities. LipaHub brings those interests into one account while keeping the limits of each service clear.</p>
    <div className="guide-grid">
      <section><h3>LipaHub Rwanda</h3><p>Rwandan members can create an account, explore learning content and follow the account-activation steps required for new registrations. Kinyarwanda and English are supported in the interface.</p></section>
      <section><h3>LipaHub Uganda</h3><p>Members in Uganda can use LipaHub to explore digital-skills resources, community previews and simulation-based education. Country-specific payment services are introduced only when configured.</p></section>
      <section><h3>LipaHub Kenya</h3><p>Kenyan members can access the same learning dashboard and public guides. Always verify any online opportunity independently and never pay an upfront fee without written terms.</p></section>
      <section><h3>LipaHub Burundi</h3><p>LipaHub is designed to support Burundian members with the same account, learning and support experience, while respecting local payment availability.</p></section>
    </div>
    <h2>Online work, Akazikeza and digital skills</h2>
    <p>If you are searching for online work, Akazikeza, side opportunities or the best-paying jobs in East Africa, start with skills and verification rather than promises. Our <Link className="text-link" to="/online-work">online work guide</Link> explains how to evaluate an opportunity and what LipaHub does and does not provide.</p>
    <h2>Start with LipaHub</h2>
    <p>Create an account to access the member dashboard, or install the app for faster access on your phone.</p>
    <p><Globe2 size={16} /> Available on the web in Rwanda, Uganda, Kenya, Burundi and beyond.</p>
  </GuidePage>
}

export function OnlineWorkPage() {
  return <GuidePage eyebrow="ONLINE WORK GUIDE" title="Online work and digital skills in East Africa" lead="Practical, honest guidance for people searching for online work, Akazikeza, side opportunities or better-paying jobs.">
    <h2>Start with skills, not promises</h2>
    <p>There is no universal list of the best-paying jobs in East Africa or the world. Pay depends on the skill, experience, employer, location, language and demand. A trustworthy opportunity explains the work, the pay, the timeline and the person or company responsible.</p>
    <h2>How to evaluate an online opportunity</h2>
    <ul className="guide-list">
      <li><CheckCircle2 size={16} /> Ask who is paying, where the company is registered and how payment will be made.</li>
      <li><CheckCircle2 size={16} /> Get the task, rate, deadlines and payment date in writing.</li>
      <li><CheckCircle2 size={16} /> Be careful with requests for upfront fees, deposits or equipment purchases.</li>
      <li><CheckCircle2 size={16} /> Never share passwords, one-time codes or full identity documents with an unverified contact.</li>
      <li><CheckCircle2 size={16} /> Test small tasks first and confirm that previous workers were paid.</li>
    </ul>
    <h2>Skills that support online income</h2>
    <p>Skills that are often useful for online work include clear communication, writing and editing, customer support, spreadsheets, basic design, digital marketing, translation and introductory coding. Learning a skill consistently is more reliable than paying for a promise of easy money.</p>
    <h2>What about Akazikeza?</h2>
    <p>People use terms such as Akazikeza when looking for small opportunities or extra income. Treat every offer with the same checks: verify the source, understand the task and avoid paying to receive work. A legitimate opportunity should not depend on recruiting other people or making an unexplained payment.</p>
    <h2>Where LipaHub fits</h2>
    <p>LipaHub provides learning resources, community previews and simulation-based education. It does not guarantee a job, income or investment return. Use the platform to build knowledge and evaluate opportunities carefully, not as a substitute for independent verification.</p>
    <div className="guide-note"><ShieldCheck size={18} /><p>If an offer promises guaranteed daily income with no clear employer or product, stop and verify it before sharing money or personal information.</p></div>
  </GuidePage>
}

export function BusinessPage() {
  return <GuidePage eyebrow="LIPA HUB BUSINESS" title="Learning, content and community partnerships" lead="LipaHub Business is the planned path for organizations that want to contribute learning content, community programmes or member support across East Africa.">
    <h2>What we are building</h2>
    <p>LipaHub Business is intended for training providers, community organizations, employers and support teams that share an interest in practical digital-skills education. The direction includes learning-content collaboration, member education and community programmes.</p>
    <p>Business partnerships are not yet open. This page explains the planned direction so organizations can start a conversation without assuming that a service is already available.</p>
    <h2>Who it is for</h2>
    <div className="guide-grid">
      <section><h3>Learning providers</h3><p>Organizations with courses, articles or practical guides that could support members building digital skills.</p></section>
      <section><h3>Community programmes</h3><p>Teams running responsible community, mentorship or digital-inclusion initiatives in East Africa.</p></section>
      <section><h3>Support teams</h3><p>Organizations interested in clear member support, moderation and transparent communication.</p></section>
      <section><h3>Employers and partners</h3><p>Partners exploring future learning or community collaboration, without promising jobs or guaranteed income.</p></section>
    </div>
    <h2>What LipaHub Business is not</h2>
    <p>LipaHub Business is not a job board, a recruitment guarantee or an investment scheme. Any future partnership must be transparent, lawful and clear about what members receive.</p>
    <h2>Start a conversation</h2>
    <p>Send an introduction to <a className="text-link" href="mailto:lipahubsupport@gmail.com">lipahubsupport@gmail.com</a>. Include your organization, the East African countries you serve and the type of learning or community collaboration you have in mind.</p>
  </GuidePage>
}
