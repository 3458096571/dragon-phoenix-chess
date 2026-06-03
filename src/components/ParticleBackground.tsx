import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

const PARTICLE_COUNT_MIN = 80;
const PARTICLE_COUNT_MAX = 120;
const CONNECTION_DISTANCE = 120;
const COLORS = ['#FFD700', '#00FF88', '#FFFFFF', '#FFA500', '#E0FFE0'];

/**
 * 生成指定范围内的随机整数
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成指定范围内的随机浮点数
 */
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 随机选择数组中的一个元素
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * ParticleBackground - 龙凰棋粒子背景组件
 *
 * 在画布上渲染缓慢飘动的金色/翡翠色/白色粒子，
 * 并在距离较近的粒子之间绘制星座连线。
 * 尊重用户的 prefers-reduced-motion 设置。
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 检测用户是否偏好减少动画
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mql.matches;

    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mql.addEventListener('change', handleMotionChange);

    /**
     * 调整画布尺寸为全屏
     */
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /**
     * 初始化粒子群
     */
    const initParticles = () => {
      const count = randomInt(PARTICLE_COUNT_MIN, PARTICLE_COUNT_MAX);
      const particles: Particle[] = [];

      for (let i = 0; i < count; i++) {
        particles.push({
          x: randomFloat(0, canvas.width),
          y: randomFloat(0, canvas.height),
          vx: randomFloat(-0.3, 0.3),
          vy: randomFloat(-0.3, 0.3),
          radius: randomFloat(1.5, 3.5),
          opacity: randomFloat(0.1, 0.4),
          color: randomChoice(COLORS),
        });
      }

      particlesRef.current = particles;
    };

    initParticles();

    /**
     * 绘制单帧画面
     */
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const reduced = reducedMotionRef.current;

      // 更新并绘制每个粒子
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!reduced) {
          // 更新位置
          p.x += p.vx;
          p.y += p.vy;

          // 边界反弹（柔和处理）
          if (p.x < -10) p.x = canvas.width + 10;
          if (p.x > canvas.width + 10) p.x = -10;
          if (p.y < -10) p.y = canvas.height + 10;
          if (p.y > canvas.height + 10) p.y = -10;
        }

        // 绘制粒子本体
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 绘制星座连线
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 0.5;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const lineOpacity = (1 - dist / CONNECTION_DISTANCE) * 0.15;
            ctx.globalAlpha = lineOpacity;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
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
