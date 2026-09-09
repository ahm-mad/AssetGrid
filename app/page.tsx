'use client'

import { useState } from 'react'

type Project = {
  id: number
  category: string
  readTime: string
  title: string
  short: string
  label: string
  description: string
  bullets: string[]
  metric: string
  metricText: string
  stack: string[]
  image: string
  screenshots: string[]
}

const projects: Project[] = [
  {
    id: 1,
    category: 'Next.js',
    readTime: '2 min read',
    title:
      'Checkout, loyalty, and analytics fixes for a multi-brand Next.js platform',
    short:
      'Built a multi-tenant checkout experience and repaired real-time analytics across a shared application platform.',
    label: 'BAU / ENTERPRISE SUBSCRIPTION PLATFORM',
    description:
      'A multi-brand platform needed a reliable checkout experience, real-time event tracking, and better database performance across several customer-facing flows.',
    bullets: [
      'Built a multi-tenant checkout sequence using Next.js and TypeScript',
      'Repaired recurring real-time event and analytics synchronization issues',
      'Optimized database access patterns responsible for checkout bottlenecks',
      'Improved dashboard telemetry and operational monitoring',
    ],
    metric: '8 months',
    metricText:
      'of continuous platform management across checkout, analytics, and production fixes.',
    stack: ['Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Supabase'],
    image:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=85',
    screenshots: [
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1556740714-a8395b3bf30f?auto=format&fit=crop&w=1600&q=85',
    ],
  },
  {
    id: 2,
    category: 'MERN',
    readTime: '2 min read',
    title:
      'High-availability infrastructure migration and multi-tenant MERN platform',
    short:
      'Reworked backend architecture, database queries, and analytics infrastructure for a high-volume application.',
    label: 'PLATFORM OWNERSHIP / CORE INFRASTRUCTURE',
    description:
      'The platform had increasingly complex queries and infrastructure bottlenecks that affected dashboard performance and operational reliability.',
    bullets: [
      'Restructured Node.js services and backend processing',
      'Optimized MongoDB query patterns and lookup trees',
      'Introduced isolated analytics processing routines',
      'Improved infrastructure reliability and deployment workflows',
    ],
    metric: '45%',
    metricText:
      'faster dashboard data processing after structural query redesigns.',
    stack: ['MongoDB', 'Express', 'React', 'Node.js', 'AWS'],
    image:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1800&q=85',
    screenshots: [
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=85',
    ],
  },
  {
    id: 3,
    category: 'Supabase',
    readTime: '2 min read',
    title:
      'Real-time multi-vendor SaaS directory built with Next.js and Supabase',
    short:
      'Built a secure real-time directory with role-based access, automated verification, and scalable data rules.',
    label: 'BUILD / DIRECTORY & SECURE SYSTEM',
    description:
      'The product required real-time updates, multi-vendor access controls, secure database policies, and a responsive interface.',
    bullets: [
      'Built the application using Next.js and TypeScript',
      'Implemented Supabase Row-Level Security policies',
      'Created real-time verification and synchronization flows',
      'Designed secure vendor and administrator permissions',
    ],
    metric: '0',
    metricText:
      'recorded data leaks across thousands of concurrent operations.',
    stack: ['Next.js', 'TypeScript', 'Supabase', 'PostgreSQL', 'Tailwind'],
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85',
    screenshots: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=85',
    ],
  },
  {
    id: 4,
    category: 'Next.js',
    readTime: '1 min read',
    title: 'Modern SaaS dashboard and real-time analytics application',
    short:
      'Designed and implemented a responsive analytics platform with real-time dashboard updates.',
    label: 'BUILD / SAAS ANALYTICS PLATFORM',
    description:
      'A growing SaaS product needed a faster interface, reusable component architecture, and live operational dashboards.',
    bullets: [
      'Built reusable React and Next.js interface architecture',
      'Created responsive analytics dashboards',
      'Connected live backend data streams',
      'Improved frontend rendering and loading performance',
    ],
    metric: '60%',
    metricText:
      'reduction in perceived dashboard loading time after frontend optimization.',
    stack: ['Next.js', 'React', 'TypeScript', 'Node.js', 'Redis'],
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85',
    screenshots: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=85',
    ],
  },
]

const clients = [
  'ASTLEY CLARKE',
  'CONVERSE',
  'GERMAN DELI',
  'HIEXPERTS',
  'KITCHENZ',
  'SAHRAI',
  'PERFECTDRAFT',
  'PROPERSPACE',
]

const capabilities = [
  {
    title: 'Frontend',
    text: 'React, Next.js, TypeScript, responsive interfaces, component systems and performance-focused UI architecture.',
  },
  {
    title: 'Backend',
    text: 'Node.js, Express, APIs, authentication, database architecture, queues and production services.',
  },
  {
    title: 'Data & Security',
    text: 'PostgreSQL, MongoDB, Supabase, Row-Level Security, data modeling and real-time systems.',
  },
  {
    title: 'Infrastructure',
    text: 'AWS, Docker, CI/CD, serverless deployment, monitoring and production troubleshooting.',
  },
  {
    title: 'Product Engineering',
    text: 'Turning business requirements into maintainable systems with clear architecture and measurable outcomes.',
  },
  {
    title: 'AI Integration',
    text: 'LLM APIs, RAG workflows, automation and AI-assisted features integrated into existing applications.',
  },
]

const process = [
  {
    number: '01',
    title: 'Discovery & audit',
    text: 'I understand the existing system, identify technical risks, and establish the real problem before changing production code.',
  },
  {
    number: '02',
    title: 'Architecture',
    text: 'I define the data model, application boundaries, API contracts and implementation strategy before development begins.',
  },
  {
    number: '03',
    title: 'Build & verify',
    text: 'Development happens incrementally with isolated environments, repeatable testing and continuous technical validation.',
  },
  {
    number: '04',
    title: 'Deploy & improve',
    text: 'The finished system is deployed safely, monitored in production and continuously improved based on real-world behavior.',
  },
]

export default function Page() {
  const [filter, setFilter] = useState('All')
  const [activeProject, setActiveProject] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const filteredProjects =
    filter === 'All'
      ? projects
      : projects.filter((project) => project.category === filter)

  const project = projects.find((item) => item.id === activeProject)

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #f5f5f2;
          color: #171717;
          font-family: Arial, Helvetica, sans-serif;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        ::selection {
          background: #171717;
          color: #fff;
        }

        .page {
          width: 100%;
          overflow: hidden;
        }

        .container {
          width: min(1400px, calc(100% - 64px));
          margin: 0 auto;
        }

        .mono {
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
          font-size: 11px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          background: rgba(245,245,242,.94);
          border-bottom: 1px solid #deded9;
          backdrop-filter: blur(12px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -.02em;
        }

        .brandDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #171717;
        }

        .navLinks {
          display: flex;
          align-items: center;
          gap: 28px;
          color: #666;
        }

        .navLinks a:hover {
          color: #111;
        }

        .navCta {
          padding: 11px 17px;
          border: 1px solid #171717;
          background: #171717;
          color: #fff;
          transition: .2s;
        }

        .navCta:hover {
          background: transparent;
          color: #171717;
        }

        .menuButton {
          display: none;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .hero {
          padding: 120px 0 90px;
        }

        .eyebrow {
          color: #777;
          margin-bottom: 28px;
        }

        .heroGrid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 80px;
          align-items: end;
        }

        .heroTitle {
          max-width: 1050px;
          margin: 0;
          font-size: clamp(58px, 8.4vw, 126px);
          line-height: .88;
          letter-spacing: -.075em;
          font-weight: 600;
        }

        .heroSide {
          padding-bottom: 7px;
          color: #626262;
          line-height: 1.6;
          font-size: 14px;
        }

        .heroActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 48px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 20px;
          border: 1px solid #171717;
          font-size: 12px;
          font-family: monospace;
          text-transform: uppercase;
          letter-spacing: .05em;
          transition: .2s;
        }

        .buttonDark {
          background: #171717;
          color: #fff;
        }

        .buttonDark:hover {
          background: transparent;
          color: #171717;
        }

        .buttonLight:hover {
          background: #171717;
          color: #fff;
        }

        .visualIntro {
          padding: 20px 0 130px;
        }

        .visualGrid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 12px;
        }

        .visualCard {
          position: relative;
          min-height: 420px;
          overflow: hidden;
          background: #ddd;
        }

        .visualCard:nth-child(2) {
          margin-top: 80px;
        }

        .visualCard:nth-child(3) {
          margin-top: 160px;
        }

        .visualCard img {
          width: 100%;
          height: 100%;
          min-height: 420px;
          object-fit: cover;
          filter: grayscale(100%);
          transition: transform .7s ease;
        }

        .visualCard:hover img {
          transform: scale(1.04);
        }

        .visualNumber {
          position: absolute;
          top: 16px;
          left: 16px;
          color: #fff;
          mix-blend-mode: difference;
          z-index: 2;
        }

        .trust {
          border-top: 1px solid #d7d7d2;
          padding: 90px 0 120px;
        }

        .sectionTop {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 50px;
        }

        .sectionLabel {
          color: #777;
        }

        .sectionTitle {
          max-width: 900px;
          margin: 0;
          font-size: clamp(38px, 5.2vw, 76px);
          line-height: .98;
          letter-spacing: -.055em;
          font-weight: 500;
        }

        .recordLine {
          margin-top: 25px;
          color: #777;
          font-family: monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .capabilityGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid #d7d7d2;
          margin-top: 90px;
        }

        .capability {
          min-height: 220px;
          padding: 28px 28px 28px 0;
          border-bottom: 1px solid #d7d7d2;
        }

        .capability:nth-child(3n+2),
        .capability:nth-child(3n+3) {
          padding-left: 28px;
          border-left: 1px solid #d7d7d2;
        }

        .capabilityTitle {
          margin-bottom: 30px;
          font-size: 15px;
          font-weight: 600;
        }

        .capabilityText {
          max-width: 320px;
          color: #666;
          font-size: 14px;
          line-height: 1.65;
        }

        .clients {
          padding: 30px 0 100px;
        }

        .clientsTitle {
          margin-bottom: 40px;
          color: #777;
        }

        .clientGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid #d7d7d2;
          border-left: 1px solid #d7d7d2;
        }

        .client {
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-right: 1px solid #d7d7d2;
          border-bottom: 1px solid #d7d7d2;
          color: #777;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .08em;
        }

        .work {
          padding: 100px 0 150px;
          border-top: 1px solid #d7d7d2;
        }

        .workIntro {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 50px;
          margin-bottom: 65px;
        }

        .workIntro h2 {
          margin: 0;
          font-size: clamp(44px, 6vw, 88px);
          line-height: .95;
          letter-spacing: -.06em;
          font-weight: 500;
        }

        .workIntro p {
          max-width: 560px;
          margin: 0;
          color: #666;
          font-size: 16px;
          line-height: 1.6;
        }

        .filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 70px;
        }

        .filter {
          padding: 10px 14px;
          border: 1px solid #d0d0cb;
          background: transparent;
          color: #777;
          cursor: pointer;
          font-family: monospace;
          font-size: 10px;
          text-transform: uppercase;
        }

        .filter.active,
        .filter:hover {
          background: #171717;
          color: #fff;
          border-color: #171717;
        }

        .project {
          padding: 0 0 110px;
          margin-bottom: 100px;
          border-bottom: 1px solid #d7d7d2;
        }

        .projectHeader {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 50px;
          margin-bottom: 35px;
        }

        .projectMeta {
          color: #777;
        }

        .projectMeta span {
          display: block;
          margin-bottom: 7px;
        }

        .projectTitle {
          max-width: 850px;
          margin: 0;
          font-size: clamp(34px, 4.5vw, 66px);
          line-height: .98;
          letter-spacing: -.05em;
          font-weight: 500;
        }

        .projectImage {
          width: 100%;
          aspect-ratio: 16 / 8;
          overflow: hidden;
          background: #ddd;
          cursor: pointer;
        }

        .projectImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: grayscale(20%);
          transition: transform .7s ease;
        }

        .projectImage:hover img {
          transform: scale(1.025);
        }

        .projectInfo {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 45px;
          padding-top: 35px;
        }

        .projectInfo h4 {
          margin: 0 0 18px;
          font-family: monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: #777;
        }

        .projectInfo p {
          margin: 0;
          color: #555;
          font-size: 14px;
          line-height: 1.65;
        }

        .projectBullets {
          margin: 0;
          padding-left: 18px;
          color: #555;
          font-size: 14px;
          line-height: 1.8;
        }

        .metric {
          border-left: 1px solid #d7d7d2;
          padding-left: 30px;
        }

        .metricNumber {
          display: block;
          margin-bottom: 8px;
          font-size: clamp(42px, 5vw, 70px);
          letter-spacing: -.06em;
        }

        .metricText {
          color: #777;
          font-size: 12px;
          line-height: 1.55;
        }

        .stack {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 25px;
        }

        .stack span {
          padding: 7px 9px;
          border: 1px solid #d8d8d3;
          font-family: monospace;
          font-size: 9px;
          color: #777;
        }

        .viewProject {
          display: inline-block;
          margin-top: 30px;
          border-bottom: 1px solid #171717;
          padding-bottom: 5px;
          font-family: monospace;
          font-size: 10px;
          text-transform: uppercase;
        }

        .process {
          padding: 100px 0 150px;
          border-top: 1px solid #d7d7d2;
        }

        .processGrid {
          margin-top: 80px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid #d7d7d2;
        }

        .processItem {
          min-height: 280px;
          padding: 25px 25px 25px 0;
          border-bottom: 1px solid #d7d7d2;
        }

        .processItem + .processItem {
          border-left: 1px solid #d7d7d2;
          padding-left: 25px;
        }

        .processNumber {
          color: #888;
          margin-bottom: 75px;
        }

        .processTitle {
          font-size: 18px;
          margin-bottom: 16px;
        }

        .processText {
          color: #666;
          font-size: 13px;
          line-height: 1.6;
        }

        .testimonials {
          padding: 100px 0 150px;
          border-top: 1px solid #d7d7d2;
        }

        .testimonialGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: #d7d7d2;
          margin-top: 80px;
        }

        .testimonial {
          background: #f5f5f2;
          padding: 45px;
          min-height: 330px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .testimonialQuote {
          font-size: clamp(24px, 3vw, 38px);
          line-height: 1.12;
          letter-spacing: -.035em;
        }

        .testimonialAuthor {
          color: #777;
          font-family: monospace;
          font-size: 10px;
          text-transform: uppercase;
          line-height: 1.7;
        }

        .contact {
          padding: 110px 0 130px;
          background: #171717;
          color: #fff;
        }

        .contactGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 100px;
        }

        .contactTitle {
          margin: 25px 0 35px;
          max-width: 650px;
          font-size: clamp(50px, 7vw, 105px);
          line-height: .88;
          letter-spacing: -.07em;
          font-weight: 500;
        }

        .contactText {
          max-width: 440px;
          color: #aaa;
          font-size: 14px;
          line-height: 1.7;
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .field {
          border-bottom: 1px solid #444;
          padding-bottom: 12px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #888;
          font-family: monospace;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #fff;
          font-size: 15px;
        }

        .field select option {
          color: #111;
        }

        .field textarea {
          min-height: 110px;
          resize: vertical;
        }

        .submit {
          align-self: flex-start;
          margin-top: 10px;
          padding: 15px 25px;
          border: 1px solid #fff;
          background: #fff;
          color: #171717;
          cursor: pointer;
          font-family: monospace;
          font-size: 10px;
          text-transform: uppercase;
          transition: .2s;
        }

        .submit:hover {
          background: transparent;
          color: #fff;
        }

        .footer {
          background: #171717;
          color: #888;
          border-top: 1px solid #333;
          padding: 28px 0;
        }

        .footerInner {
          display: flex;
          justify-content: space-between;
          gap: 30px;
          align-items: center;
        }

        .footerLinks {
          display: flex;
          gap: 25px;
        }

        .footerLinks a:hover {
          color: #fff;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          background: rgba(0,0,0,.65);
        }

        .modal {
          width: min(1100px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: #f5f5f2;
          color: #171717;
          padding: 35px;
        }

        .modalTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
        }

        .close {
          width: 40px;
          height: 40px;
          border: 1px solid #ccc;
          background: transparent;
          cursor: pointer;
          font-size: 20px;
        }

        .modal h2 {
          max-width: 800px;
          margin: 0 0 40px;
          font-size: clamp(36px, 5vw, 70px);
          line-height: .95;
          letter-spacing: -.055em;
          font-weight: 500;
        }

        .modalImages {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .modalImages img {
          width: 100%;
          display: block;
        }

        @media (max-width: 900px) {
          .container {
            width: min(100% - 36px, 700px);
          }

          .nav {
            padding: 0 18px;
          }

          .navLinks,
          .navCta {
            display: none;
          }

          .menuButton {
            display: block;
          }

          .mobileMenu {
            position: absolute;
            top: 72px;
            left: 0;
            right: 0;
            background: #f5f5f2;
            border-bottom: 1px solid #ddd;
            padding: 20px;
          }

          .mobileMenu a {
            display: block;
            padding: 14px 0;
            border-bottom: 1px solid #ddd;
            font-family: monospace;
            font-size: 11px;
            text-transform: uppercase;
          }

          .hero {
            padding: 80px 0 60px;
          }

          .heroGrid,
          .sectionTop,
          .workIntro,
          .projectHeader,
          .contactGrid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .heroTitle {
            font-size: clamp(55px, 17vw, 100px);
          }

          .heroSide {
            max-width: 450px;
          }

          .visualGrid {
            grid-template-columns: 1fr;
          }

          .visualCard,
          .visualCard:nth-child(2),
          .visualCard:nth-child(3) {
            margin-top: 0;
            min-height: 300px;
          }

          .visualCard img {
            min-height: 300px;
          }

          .capabilityGrid {
            grid-template-columns: 1fr 1fr;
          }

          .capability:nth-child(3n+2),
          .capability:nth-child(3n+3) {
            padding-left: 0;
            border-left: 0;
          }

          .capability:nth-child(even) {
            padding-left: 25px;
            border-left: 1px solid #d7d7d2;
          }

          .clientGrid {
            grid-template-columns: 1fr 1fr;
          }

          .projectInfo {
            grid-template-columns: 1fr;
            gap: 35px;
          }

          .metric {
            border-left: 0;
            border-top: 1px solid #d7d7d2;
            padding: 30px 0 0;
          }

          .processGrid {
            grid-template-columns: 1fr 1fr;
          }

          .processItem:nth-child(3) {
            border-left: 0;
            padding-left: 0;
          }

          .processItem:nth-child(even) {
            border-left: 1px solid #d7d7d2;
            padding-left: 25px;
          }

          .testimonialGrid {
            grid-template-columns: 1fr;
          }

          .contactGrid {
            gap: 60px;
          }
        }

        @media (max-width: 600px) {
          .capabilityGrid,
          .processGrid {
            grid-template-columns: 1fr;
          }

          .capability:nth-child(even),
          .processItem:nth-child(even) {
            border-left: 0;
            padding-left: 0;
          }

          .clientGrid {
            grid-template-columns: 1fr 1fr;
          }

          .client {
            height: 85px;
            font-size: 10px;
          }

          .projectImage {
            aspect-ratio: 4 / 3;
          }

          .testimonial {
            padding: 30px;
          }

          .footerInner {
            flex-direction: column;
            align-items: flex-start;
          }

          .modal {
            padding: 20px;
          }
        }
      `}</style>

      <div className="page">
        {/* NAVIGATION */}
        <nav className="nav">
          <a href="#" className="brand">
            <span className="brandDot" />
            Your Name Solutions
          </a>

          <div className="navLinks mono">
            <a href="#work">Work</a>
            <a href="#process">How I work</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#contact">Contact</a>
          </div>

          <a href="#contact" className="navCta mono">
            Schedule a call
          </a>

          <button
            className="menuButton mono"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </button>

          {menuOpen && (
            <div className="mobileMenu">
              <a href="#work" onClick={() => setMenuOpen(false)}>
                Work
              </a>
              <a href="#process" onClick={() => setMenuOpen(false)}>
                How I work
              </a>
              <a
                href="#testimonials"
                onClick={() => setMenuOpen(false)}
              >
                Testimonials
              </a>
              <a href="#contact" onClick={() => setMenuOpen(false)}>
                Contact
              </a>
            </div>
          )}
        </nav>

        {/* HERO */}
        <header className="hero">
          <div className="container">
            <div className="eyebrow mono">
              Full-Stack Engineer — MERN / Next.js / Supabase
            </div>

            <div className="heroGrid">
              <h1 className="heroTitle">
                Your
                <br />
                Name
              </h1>

              <div className="heroSide">
                <p>
                  Senior full-stack engineer specializing in scalable
                  applications, secure integrations, migrations, and
                  production-ready deployment pipelines.
                </p>

                <p>
                  6+ years building software remotely for startups,
                  agencies, and established businesses.
                </p>
              </div>
            </div>

            <div className="heroActions">
              <a href="#contact" className="button buttonDark">
                Schedule a call
              </a>

              <a href="#contact" className="button buttonLight">
                Contact
              </a>

              <a href="#work" className="button buttonLight">
                See work
              </a>
            </div>
          </div>
        </header>

        {/* INTRO VISUALS */}
        <section className="visualIntro">
          <div className="container">
            <div className="visualGrid">
              <div className="visualCard">
                <span className="visualNumber mono">01</span>
                <img
                  src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=85"
                  alt="Development workspace"
                />
              </div>

              <div className="visualCard">
                <span className="visualNumber mono">02</span>
                <img
                  src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=85"
                  alt="Code"
                />
              </div>

              <div className="visualCard">
                <span className="visualNumber mono">03</span>
                <img
                  src="https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=85"
                  alt="Interface design"
                />
              </div>
            </div>
          </div>
        </section>

        {/* TECHNICAL RECORD */}
        <section className="trust">
          <div className="container">
            <div className="sectionTop">
              <div>
                <span className="sectionLabel mono">
                  Trust
                </span>
              </div>

              <div>
                <h2 className="sectionTitle">
                  A precise technical record.
                </h2>

                <div className="recordLine">
                  MERN · NEXT.JS · SUPABASE · TYPESCRIPT · REMOTE ·
                  PAKISTAN
                </div>
              </div>
            </div>

            <div className="capabilityGrid">
              {capabilities.map((item) => (
                <div className="capability" key={item.title}>
                  <div className="capabilityTitle">
                    {item.title}
                  </div>

                  <div className="capabilityText">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CLIENTS */}
        <section className="clients">
          <div className="container">
            <div className="clientsTitle mono">
              Clients & collaborations
            </div>

            <div className="clientGrid">
              {clients.map((client) => (
                <div className="client" key={client}>
                  {client}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WORK */}
        <section className="work" id="work">
          <div className="container">
            <div className="workIntro">
              <div className="mono">Work</div>

              <div>
                <h2>
                  Selected
                  <br />
                  work.
                </h2>

                <p style={{ marginTop: 30 }}>
                  Real client projects, the problem, the action taken,
                  and one metric that proves the result.
                </p>
              </div>
            </div>

            <div className="filters">
              {['All', 'Next.js', 'MERN', 'Supabase'].map(
                (item) => (
                  <button
                    key={item}
                    className={`filter ${
                      filter === item ? 'active' : ''
                    }`}
                    onClick={() => setFilter(item)}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            {filteredProjects.map((item) => (
              <article className="project" key={item.id}>
                <div className="projectHeader">
                  <div className="projectMeta mono">
                    <span>{item.category}</span>
                    <span>{item.readTime}</span>
                  </div>

                  <h3 className="projectTitle">
                    {item.title}
                  </h3>
                </div>

                <div
                  className="projectImage"
                  onClick={() => setActiveProject(item.id)}
                >
                  <img src={item.image} alt={item.title} />
                </div>

                <div className="projectInfo">
                  <div>
                    <h4>Overview</h4>

                    <p>{item.description}</p>

                    <a
                      href="#"
                      className="viewProject"
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveProject(item.id)
                      }}
                    >
                      View project →
                    </a>
                  </div>

                  <div>
                    <h4>What I did</h4>

                    <ul className="projectBullets">
                      {item.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>

                    <div className="stack">
                      {item.stack.map((tech) => (
                        <span key={tech}>{tech}</span>
                      ))}
                    </div>
                  </div>

                  <div className="metric">
                    <h4>Result</h4>

                    <span className="metricNumber">
                      {item.metric}
                    </span>

                    <div className="metricText">
                      {item.metricText}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* PROCESS */}
        <section className="process" id="process">
          <div className="container">
            <div className="sectionTop">
              <div>
                <span className="sectionLabel mono">
                  How I work
                </span>
              </div>

              <h2 className="sectionTitle">
                Engineering without unnecessary complexity.
              </h2>
            </div>

            <div className="processGrid">
              {process.map((item) => (
                <div className="processItem" key={item.number}>
                  <div className="processNumber mono">
                    {item.number}
                  </div>

                  <div className="processTitle">
                    {item.title}
                  </div>

                  <div className="processText">
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="testimonials" id="testimonials">
          <div className="container">
            <div className="sectionTop">
              <div>
                <span className="sectionLabel mono">
                  Testimonials
                </span>
              </div>

              <h2 className="sectionTitle">
                Trusted by people who care about the details.
              </h2>
            </div>

            <div className="testimonialGrid">
              <div className="testimonial">
                <div className="testimonialQuote">
                  “The architectural insight across our Next.js
                  and data systems was exceptional. Persistent
                  operational issues were identified and permanently
                  resolved.”
                </div>

                <div className="testimonialAuthor">
                  Bernhard
                  <br />
                  Founder · Enterprise Technology
                  <br />
                  LinkedIn
                </div>
              </div>

              <div className="testimonial">
                <div className="testimonialQuote">
                  “An incredibly detailed full-stack engineer.
                  Outstanding command of complex database rules,
                  type systems and responsive interfaces.”
                </div>

                <div className="testimonialAuthor">
                  Alex Newman
                  <br />
                  Technical Lead · SaaS
                  <br />
                  Upwork
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className="contact" id="contact">
          <div className="container">
            <div className="contactGrid">
              <div>
                <div className="mono">
                  Contact
                </div>

                <h2 className="contactTitle">
                  Something to build?
                  <br />
                  Let&apos;s talk.
                </h2>

                <p className="contactText">
                  Tell me what you are building, what is broken,
                  or where the existing system is slowing you
                  down. I&apos;ll come back with a practical
                  technical direction.
                </p>
              </div>

              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  alert('Thanks — your enquiry has been captured.')
                }}
              >
                <div className="field">
                  <label>Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Your name"
                  />
                </div>

                <div className="field">
                  <label>Email</label>
                  <input
                    required
                    type="email"
                    placeholder="you@company.com"
                  />
                </div>

                <div className="field">
                  <label>Business</label>
                  <input
                    type="text"
                    placeholder="Company / business"
                  />
                </div>

                <div className="field">
                  <label>Enquiry type</label>
                  <select defaultValue="General">
                    <option value="General">
                      General project
                    </option>
                    <option value="Next.js">
                      Next.js / React
                    </option>
                    <option value="MERN">
                      MERN stack
                    </option>
                    <option value="Supabase">
                      Supabase / Database
                    </option>
                    <option value="Migration">
                      Migration / Modernization
                    </option>
                  </select>
                </div>

                <div className="field">
                  <label>Message</label>
                  <textarea
                    required
                    placeholder="Tell me about the project..."
                  />
                </div>

                <button className="submit" type="submit">
                  Send enquiry →
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="container">
            <div className="footerInner">
              <div className="mono">
                © 2026 Your Name Solutions
              </div>

              <div className="footerLinks mono">
                <a href="#">GitHub</a>
                <a href="#">LinkedIn</a>
                <a href="#contact">Contact</a>
              </div>
            </div>
          </div>
        </footer>

        {/* PROJECT MODAL */}
        {project && (
          <div
            className="modalBackdrop"
            onClick={() => setActiveProject(null)}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modalTop">
                <span className="mono">
                  {project.category} · Case study
                </span>

                <button
                  className="close"
                  onClick={() => setActiveProject(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <h2>{project.title}</h2>

              <div className="modalImages">
                {project.screenshots.map((image, index) => (
                  <img
                    key={image}
                    src={image}
                    alt={`${project.title} screenshot ${
                      index + 1
                    }`}
                  />
                ))}
              </div>

              <div
                className="projectInfo"
                style={{ marginTop: 40 }}
              >
                <div>
                  <h4>Project</h4>
                  <p>{project.description}</p>
                </div>

                <div>
                  <h4>Implementation</h4>
                  <ul className="projectBullets">
                    {project.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>

                <div className="metric">
                  <h4>Result</h4>

                  <span className="metricNumber">
                    {project.metric}
                  </span>

                  <div className="metricText">
                    {project.metricText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
