"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  velocity: {
    x: number;
    y: number;
  };
  lifespan: number;
  age: number;
}

interface ParticleEffectProps {
  count?: number;
  colors?: string[];
  minSize?: number;
  maxSize?: number;
  speed?: number;
  fadeOut?: boolean;
  mouseInteraction?: boolean;
  shape?: "circle" | "square" | "star" | "heart";
  className?: string;
  children?: React.ReactNode;
}

export const ParticleEffect: React.FC<ParticleEffectProps> = ({
  count = 50,
  colors = ["#FF10F0", "#00FFF0", "#9D00FF", "#00FF88", "#FFD700"],
  minSize = 2,
  maxSize = 8,
  speed = 1,
  fadeOut = true,
  mouseInteraction = true,
  shape = "circle",
  className,
  children,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);

  // 파티클 생성
  const createParticle = (x?: number, y?: number): Particle => {
    const container = containerRef.current;
    if (!container) return null!;

    const rect = container.getBoundingClientRect();
    
    return {
      id: Math.random(),
      x: x ?? Math.random() * rect.width,
      y: y ?? Math.random() * rect.height,
      size: Math.random() * (maxSize - minSize) + minSize,
      color: colors[Math.floor(Math.random() * colors.length)],
      velocity: {
        x: (Math.random() - 0.5) * speed,
        y: (Math.random() - 0.5) * speed,
      },
      lifespan: 100,
      age: 0,
    };
  };

  // 초기 파티클 생성
  useEffect(() => {
    const initialParticles = Array.from({ length: count }, () => createParticle());
    setParticles(initialParticles.filter(Boolean));
  }, [count]);

  // 마우스 추적
  useEffect(() => {
    if (!mouseInteraction) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });

      // 마우스 위치에 새 파티클 추가
      if (particles.length < count * 1.5) {
        const newParticle = createParticle(e.clientX - rect.left, e.clientY - rect.top);
        if (newParticle) {
          setParticles((prev) => [...prev, newParticle]);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseInteraction, particles.length, count]);

  // 파티클 애니메이션 업데이트
  useEffect(() => {
    const updateParticles = () => {
      setParticles((prevParticles) => {
        const container = containerRef.current;
        if (!container) return prevParticles;

        const rect = container.getBoundingClientRect();

        return prevParticles
          .map((particle) => {
            let newX = particle.x + particle.velocity.x;
            let newY = particle.y + particle.velocity.y;
            let newVelocityX = particle.velocity.x;
            let newVelocityY = particle.velocity.y;

            // 벽 충돌 감지
            if (newX <= 0 || newX >= rect.width) {
              newVelocityX = -newVelocityX;
            }
            if (newY <= 0 || newY >= rect.height) {
              newVelocityY = -newVelocityY;
            }

            // 마우스 상호작용
            if (mouseInteraction && mousePosition.x && mousePosition.y) {
              const dx = mousePosition.x - newX;
              const dy = mousePosition.y - newY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 100) {
                const force = (100 - distance) / 100;
                newVelocityX -= (dx / distance) * force * 0.5;
                newVelocityY -= (dy / distance) * force * 0.5;
              }
            }

            return {
              ...particle,
              x: newX,
              y: newY,
              velocity: {
                x: newVelocityX * 0.99, // 마찰
                y: newVelocityY * 0.99,
              },
              age: particle.age + 1,
            };
          })
          .filter((particle) => !fadeOut || particle.age < particle.lifespan);
      });

      // 파티클이 너무 적으면 새로 생성
      if (particles.length < count / 2) {
        const newParticles = Array.from({ length: 5 }, () => createParticle());
        setParticles((prev) => [...prev, ...newParticles.filter(Boolean)]);
      }
    };

    animationFrameId.current = requestAnimationFrame(function animate() {
      updateParticles();
      animationFrameId.current = requestAnimationFrame(animate);
    });

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [mousePosition, mouseInteraction, fadeOut, count]);

  const renderShape = (particle: Particle) => {
    const opacity = fadeOut ? 1 - particle.age / particle.lifespan : 1;

    switch (shape) {
      case "circle":
        return (
          <circle
            cx={particle.size / 2}
            cy={particle.size / 2}
            r={particle.size / 2}
            fill={particle.color}
            opacity={opacity}
          />
        );
      case "square":
        return (
          <rect
            width={particle.size}
            height={particle.size}
            fill={particle.color}
            opacity={opacity}
          />
        );
      case "star":
        return (
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={particle.color}
            opacity={opacity}
            transform={`scale(${particle.size / 24})`}
          />
        );
      case "heart":
        return (
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill={particle.color}
            opacity={opacity}
            transform={`scale(${particle.size / 24})`}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full h-full overflow-hidden", className)}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <AnimatePresence>
          {particles.map((particle) => (
            <motion.g
              key={particle.id}
              initial={{ scale: 0 }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: 1,
              }}
              exit={{ scale: 0 }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 10,
              }}
            >
              {renderShape(particle)}
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>
      {children}
    </div>
  );
};

// 파티클 버스트 효과
export const ParticleBurst: React.FC<{
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  duration?: number;
  onComplete?: () => void;
}> = ({ x, y, count = 20, colors = ["#FF10F0", "#00FFF0", "#9D00FF"], duration = 1000, onComplete }) => {
  const [particles, setParticles] = useState<Array<{ id: number; angle: number; distance: number; color: string }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (Math.PI * 2 * i) / count,
      distance: Math.random() * 100 + 50,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [x, y, count, colors, duration, onComplete]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: x,
              top: y,
              backgroundColor: particle.color,
            }}
            initial={{ scale: 0, x: 0, y: 0 }}
            animate={{
              scale: [1, 0],
              x: Math.cos(particle.angle) * particle.distance,
              y: Math.sin(particle.angle) * particle.distance,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              duration: duration / 1000,
              ease: "easeOut",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};