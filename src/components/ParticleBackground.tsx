import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  depth: number; // 0-1, for parallax
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  opacity: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
  pulseSpeed: number;
  pulsePhase: number;
  depth: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  driftSpeed: number;
  driftPhase: number;
}

// 梦幻配色 - 星空紫、银河蓝、星光金、星云粉
const STAR_COLORS = ['#FFD700', '#FFF8DC', '#FFE4B5', '#E0FFE0', '#B0E0E6', '#DDA0DD', '#F0E68C', '#FFB6C1'];
const PARTICLE_COLORS = ['#FFD700', '#00FF88', '#FFA500', '#FF69B4', '#87CEEB', '#DDA0DD', '#7B68EE', '#00CED1'];
const NEBULA_COLORS = [
  'rgba(138, 43, 226, 0.08)',   // 紫罗兰
  'rgba(75, 0, 130, 0.06)',     // 靛蓝
  'rgba(25, 25, 112, 0.07)',    // 午夜蓝
  'rgba(72, 61, 139, 0.05)',    // 暗岩蓝
  'rgba(123, 104, 238, 0.06)',  // 中紫
];

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * StarBackground - 抖音"折星"风格梦幻粒子背景
 * 多层星空 + 流星 + 漂浮光尘 + 星云 + 鼠标视差
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const particlesRef = useRef<FloatingParticle[]>([]);
  const nebulasRef = useRef<NebulaCloud[]>([]);
  const animationRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mql.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mql.addEventListener('change', handleMotionChange);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
      initParticles();
      initNebulas();
    };

    // 初始化星星 - 三层深度
    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 3000);
      const stars: Star[] = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: randomFloat(0, canvas.width),
          y: randomFloat(0, canvas.height),
          baseRadius: randomFloat(0.3, 2.5),
          radius: randomFloat(0.3, 2.5),
          opacity: randomFloat(0.2, 0.9),
          twinkleSpeed: randomFloat(0.01, 0.06),
          twinklePhase: randomFloat(0, Math.PI * 2),
          color: randomChoice(STAR_COLORS),
          depth: randomFloat(0.1, 1.0),
        });
      }
      starsRef.current = stars;
    };

    // 初始化漂浮粒子
    const initParticles = () => {
      const count = Math.floor((canvas.width * canvas.height) / 25000);
      const particles: FloatingParticle[] = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: randomFloat(0, canvas.width),
          y: randomFloat(0, canvas.height),
          vx: randomFloat(-0.15, 0.15),
          vy: randomFloat(-0.15, 0.15),
          radius: randomFloat(0.5, 2.5),
          opacity: randomFloat(0.1, 0.5),
          color: randomChoice(PARTICLE_COLORS),
          pulseSpeed: randomFloat(0.02, 0.07),
          pulsePhase: randomFloat(0, Math.PI * 2),
          depth: randomFloat(0.3, 0.9),
        });
      }
      particlesRef.current = particles;
    };

    // 初始化星云
    const initNebulas = () => {
      const count = Math.floor((canvas.width * canvas.height) / 400000) + 3;
      const nebulas: NebulaCloud[] = [];
      for (let i = 0; i < count; i++) {
        nebulas.push({
          x: randomFloat(0, canvas.width),
          y: randomFloat(0, canvas.height),
          radius: randomFloat(150, 400),
          color: randomChoice(NEBULA_COLORS),
          opacity: randomFloat(0.3, 0.8),
          driftSpeed: randomFloat(0.0005, 0.002),
          driftPhase: randomFloat(0, Math.PI * 2),
        });
      }
      nebulasRef.current = nebulas;
    };

    // 创建流星
    const spawnShootingStar = () => {
      if (Math.random() > 0.005) return;
      const startX = randomFloat(0, canvas.width);
      const startY = randomFloat(0, canvas.height * 0.4);
      const angle = randomFloat(Math.PI / 5, Math.PI / 2.5);
      const speed = randomFloat(6, 14);
      const colors = ['#FFFFFF', '#FFD700', '#87CEEB', '#DDA0DD', '#FFB6C1'];

      shootingStarsRef.current.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: randomFloat(50, 150),
        opacity: 1,
        life: 0,
        maxLife: randomFloat(35, 70),
        color: randomChoice(colors),
      });
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      timeRef.current += 0.016;
      const reduced = reducedMotionRef.current;
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      // 深色背景 - 星空黑
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制星云（最底层）
      const nebulas = nebulasRef.current;
      for (const neb of nebulas) {
        if (!reduced) {
          neb.driftPhase += neb.driftSpeed;
          neb.x += Math.sin(neb.driftPhase) * 0.1;
          neb.y += Math.cos(neb.driftPhase * 0.7) * 0.05;
        }

        const gradient = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
        gradient.addColorStop(0, neb.color.replace(/[\d.]+\)$/, `${neb.opacity * 0.5})`));
        gradient.addColorStop(0.5, neb.color.replace(/[\d.]+\)$/, `${neb.opacity * 0.2})`));
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // 绘制星星（带视差）
      const stars = starsRef.current;
      for (const star of stars) {
        if (!reduced) {
          star.twinklePhase += star.twinkleSpeed;
          star.radius = star.baseRadius + Math.sin(star.twinklePhase) * 0.4;
          star.opacity = 0.3 + Math.sin(star.twinklePhase) * 0.25;
        }

        // 视差偏移
        const parallaxX = mouseX * star.depth * 15;
        const parallaxY = mouseY * star.depth * 15;
        const drawX = star.x + parallaxX;
        const drawY = star.y + parallaxY;

        // 星星本体
        ctx.beginPath();
        ctx.arc(drawX, drawY, Math.max(0.1, star.radius), 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = Math.max(0.1, star.opacity);
        ctx.fill();

        // 星星十字光芒（大星星）
        if (star.radius > 1.5) {
          const glowLen = star.radius * 4;
          ctx.globalAlpha = Math.max(0.02, star.opacity * 0.3);
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 0.5;

          ctx.beginPath();
          ctx.moveTo(drawX - glowLen, drawY);
          ctx.lineTo(drawX + glowLen, drawY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(drawX, drawY - glowLen);
          ctx.lineTo(drawX, drawY + glowLen);
          ctx.stroke();
        }

        // 星星光晕
        if (star.radius > 1.0) {
          ctx.beginPath();
          ctx.arc(drawX, drawY, star.radius * 4, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, star.radius * 4);
          gradient.addColorStop(0, star.color);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = Math.max(0.02, star.opacity * 0.12);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 绘制流星
      if (!reduced) {
        spawnShootingStar();
      }
      const shootingStars = shootingStarsRef.current;
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        if (!reduced) {
          ss.x += ss.vx;
          ss.y += ss.vy;
          ss.life++;
          ss.opacity = 1 - (ss.life / ss.maxLife);
        }

        if (ss.life >= ss.maxLife || ss.x > canvas.width + 200 || ss.y > canvas.height + 200) {
          shootingStars.splice(i, 1);
          continue;
        }

        // 流星尾巴 - 渐变色
        const speed = Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy);
        const tailX = ss.x - (ss.vx / speed) * ss.length;
        const tailY = ss.y - (ss.vy / speed) * ss.length;

        const gradient = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
        gradient.addColorStop(0, ss.color.replace(')', `, ${ss.opacity})`).replace('rgb', 'rgba'));
        gradient.addColorStop(0.3, ss.color.replace(')', `, ${ss.opacity * 0.6})`).replace('rgb', 'rgba'));
        gradient.addColorStop(0.7, ss.color.replace(')', `, ${ss.opacity * 0.2})`).replace('rgb', 'rgba'));
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 流星头部光点
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${ss.opacity})`;
        ctx.fill();

        // 流星头部光晕
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 8, 0, Math.PI * 2);
        const headGradient = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 8);
        headGradient.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity * 0.5})`);
        headGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = headGradient;
        ctx.fill();
      }

      // 绘制漂浮粒子（带视差）
      const particles = particlesRef.current;
      for (const p of particles) {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
          p.pulsePhase += p.pulseSpeed;

          if (p.x < -20) p.x = canvas.width + 20;
          if (p.x > canvas.width + 20) p.x = -20;
          if (p.y < -20) p.y = canvas.height + 20;
          if (p.y > canvas.height + 20) p.y = -20;
        }

        const parallaxX = mouseX * p.depth * 20;
        const parallaxY = mouseY * p.depth * 20;
        const drawX = p.x + parallaxX;
        const drawY = p.y + parallaxY;

        const pulseRadius = p.radius + Math.sin(p.pulsePhase) * 0.5;
        const pulseOpacity = p.opacity + Math.sin(p.pulsePhase) * 0.1;

        // 粒子本体
        ctx.beginPath();
        ctx.arc(drawX, drawY, Math.max(0.1, pulseRadius), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.05, pulseOpacity);
        ctx.fill();

        // 粒子光晕
        ctx.beginPath();
        ctx.arc(drawX, drawY, pulseRadius * 5, 0, Math.PI * 2);
        const pGradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, pulseRadius * 5);
        pGradient.addColorStop(0, p.color);
        pGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = pGradient;
        ctx.globalAlpha = Math.max(0.02, pulseOpacity * 0.08);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 底部微光渐变（增加层次感）
      const bottomGradient = ctx.createLinearGradient(0, canvas.height - 200, 0, canvas.height);
      bottomGradient.addColorStop(0, 'transparent');
      bottomGradient.addColorStop(1, 'rgba(138, 43, 226, 0.03)');
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(0, canvas.height - 200, canvas.width, 200);

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      mql.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
