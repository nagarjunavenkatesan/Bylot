import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { FaGraduationCap, FaMedal, FaTrophy, FaRocket, FaCheckCircle, FaStar, FaLeaf, FaBolt, FaStore, FaShieldAlt, FaTimes } from 'react-icons/fa';

const SKILL_BADGES = [
  {
    id: 'waste-zero',
    title: 'Waste Zero Pioneer',
    category: 'Sustainability',
    chipColor: 'green',
    level: 3,
    xp: 85,
    icon: <FaLeaf style={{ color: '#10B981' }} />,
    description: 'Rescued over 25+ near-expiry meals and surplus items from local sellers.',
    unlockedAt: 'Bylot Eco Challenge 2026',
    benefits: ['10% Extra Cashback', 'Eco Badge on Profile', 'Priority Seller Access']
  },
  {
    id: 'smart-saver',
    title: 'Smart Saver Champion',
    category: 'Deals & Savings',
    chipColor: 'blue',
    level: 4,
    xp: 92,
    icon: <FaBolt style={{ color: '#4F46E5' }} />,
    description: 'Saved over ₹4,500 by claiming local markdowns and daily surplus flash deals.',
    unlockedAt: 'Bylot Smart Shopper Track 2026',
    benefits: ['Zero Delivery Fee Alerts', 'Unlocked Flash Deal Radar', 'VIP Saver Status']
  },
  {
    id: 'surplus-specialist',
    title: 'Surplus Merchant Pro',
    category: 'Local Commerce',
    chipColor: 'yellow',
    level: 2,
    xp: 60,
    icon: <FaStore style={{ color: '#F59E0B' }} />,
    description: 'Listed & sold 15+ surplus produce bundles with 100% customer satisfaction.',
    unlockedAt: 'Bylot Merchant Accelerator',
    benefits: ['Verified Merchant Blue Check', 'Top Search Ranking', 'Instant Payouts']
  },
  {
    id: 'eco-guardian',
    title: 'Community Eco Guardian',
    category: 'Impact Leader',
    chipColor: 'red',
    level: 5,
    xp: 98,
    icon: <FaShieldAlt style={{ color: '#EC4899' }} />,
    description: 'Prevented over 50kg of food landfill waste through active community sharing.',
    unlockedAt: 'Bylot Climate Initiative',
    benefits: ['Master Eco Trophy', 'Custom Store Banner', 'Featured Partner Badge']
  }
];

const BylotSkillShowcase = () => {
  const [activeModalBadge, setActiveModalBadge] = useState(null);
  const [unlockedBadges, setUnlockedBadges] = useState(['waste-zero', 'smart-saver']);
  const [confettiBurst, setConfettiBurst] = useState([]);

  const triggerUnlock = (badge) => {
    // Generate celebratory confetti dots with Bylot brand colors
    const dots = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      tx: `${(Math.random() - 0.5) * 320}px`,
      ty: `${(Math.random() - 0.5) * 320}px`,
      bg: ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6'][i % 5],
    }));
    setConfettiBurst(dots);

    if (!unlockedBadges.includes(badge.id)) {
      setUnlockedBadges(prev => [...prev, badge.id]);
    }
    setActiveModalBadge(badge);
  };

  return (
    <section className="section" style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-body)' }}>
      {/* Background Orbits & Dynamic Mesh */}
      <div className="bylot-mesh-bg" />
      <div className="google-orbit-container">
        <div className="google-shape google-shape-blue" />
        <div className="google-shape google-shape-green" />
        <div className="google-shape google-shape-yellow" />
        <div className="google-shape google-shape-red" />
        <div className="google-orbit-ring" />
      </div>

      <div className="container" style={{ position: 'relative', zIndex: 2 }}>
        {/* Header Title */}
        <div className="text-center" style={{ marginBottom: '3.5rem' }}>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="google-skill-chip blue"
            style={{ marginBottom: '1rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            <FaGraduationCap /> Bylot Eco Badges & Rewards
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bylot-skill-title"
          >
            Earn Verified Bylot Eco Mastery Badges
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ color: 'var(--text-muted)', fontSize: '1.15rem', maxWidth: '700px', margin: '0 auto' }}
          >
            Unlock exclusive verified Bylot badges as you rescue surplus food, save money, and empower your local community.
          </motion.p>
        </div>

        {/* 3D Skill Badges Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem'
        }}>
          {SKILL_BADGES.map((badge, idx) => {
            const isUnlocked = unlockedBadges.includes(badge.id);

            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="google-skill-card"
              >
                <div className="google-card-accent-bar" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className={`google-skill-chip ${badge.chipColor}`}>
                    {badge.category}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isUnlocked ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isUnlocked ? '✓ Unlocked' : '🔒 Level ' + badge.level}
                  </span>
                </div>

                <div className="google-badge-icon-wrapper">
                  <div className="google-badge-pulse-ring" style={{ borderColor: isUnlocked ? 'var(--accent)' : 'var(--primary)' }} />
                  {badge.icon}
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  {badge.title}
                </h3>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                  {badge.description}
                </p>

                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                    <span>Level {badge.level} Mastery</span>
                    <span style={{ color: 'var(--primary)' }}>{badge.xp}% XP</span>
                  </div>
                  <div className="google-progress-bar-bg">
                    <div className="google-progress-bar-fill" style={{ width: `${badge.xp}%` }} />
                  </div>
                </div>

                {/* Claim / View Skill Button */}
                <button
                  onClick={() => triggerUnlock(badge)}
                  className="bylot-btn-glow"
                  style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}
                >
                  {isUnlocked ? <FaTrophy /> : <FaRocket />}
                  {isUnlocked ? 'View Badge Certificate' : 'Unlock Badge'}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Bylot Platform Verification Seal Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            marginTop: '4rem',
            background: 'var(--bg-surface)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(79, 70, 229, 0.25)',
            borderRadius: '24px',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '1.8rem',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.3)'
            }}>
              <FaMedal />
            </div>
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
                Bylot Eco Verified Platform
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                Every order reduces food waste, lowers carbon emissions, and supports verified local businesses.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="google-skill-chip green" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
              <FaCheckCircle /> 100% Community Impact
            </div>
          </div>
        </motion.div>
      </div>

      {/* Modal Popup for Badge Certificate / Unlock */}
      <AnimatePresence>
        {activeModalBadge && (
          <div className="google-unlock-modal-overlay">
            {/* Confetti Explosion */}
            {confettiBurst.map(dot => (
              <div
                key={dot.id}
                className="confetti-dot"
                style={{
                  top: '50%',
                  left: '50%',
                  backgroundColor: dot.bg,
                  '--tx': dot.tx,
                  '--ty': dot.ty,
                }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="google-unlock-card"
            >
              <button
                onClick={() => setActiveModalBadge(null)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <FaTimes />
              </button>

              <div className="google-badge-icon-wrapper" style={{ margin: '0 auto 1.5rem', width: '90px', height: '90px', fontSize: '3rem' }}>
                <div className="google-badge-pulse-ring" style={{ borderColor: 'var(--accent)' }} />
                {activeModalBadge.icon}
              </div>

              <div className="google-skill-chip green" style={{ marginBottom: '0.75rem' }}>
                <FaCheckCircle /> Official Bylot Eco Badge
              </div>

              <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                {activeModalBadge.title}
              </h2>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {activeModalBadge.description}
              </p>

              <div style={{
                background: 'rgba(79, 70, 229, 0.08)',
                border: '1px dashed var(--primary)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                  ⭐ Unlocked Perk Privileges:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  {activeModalBadge.benefits.map((benefit, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <FaStar style={{ color: '#F59E0B', fontSize: '0.75rem' }} /> {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setActiveModalBadge(null)}
                className="bylot-btn-glow"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <FaTrophy /> Claim Badge Certificate
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default BylotSkillShowcase;
