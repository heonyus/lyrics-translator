"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedBackgroundProps {
  variant?: "gradient" | "mesh" | "aurora" | "stars" | "waves";
  className?: string;
  children?: React.ReactNode;
  intensity?: "low" | "medium" | "high";
  colors?: string[];
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = "gradient",
  className,
  children,
  intensity = "medium",
  colors = ["#667eea", "#764ba2", "#f093fb", "#f5576c"],
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const intensitySpeed = {
    low: 20,
    medium: 15,
    high: 10,
  };

  const renderBackground = () => {
    switch (variant) {
      case "gradient":
        return <GradientBackground colors={colors} speed={intensitySpeed[intensity]} />;
      case "mesh":
        return <MeshBackground colors={colors} />;
      case "aurora":
        return <AuroraBackground intensity={intensity} />;
      case "stars":
        return <StarsBackground intensity={intensity} />;
      case "waves":
        return <WavesBackground colors={colors} intensity={intensity} />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <div className="absolute inset-0 -z-10">
        {renderBackground()}
      </div>
      {children}
    </div>
  );
};

// 그라디언트 배경
const GradientBackground: React.FC<{ colors: string[]; speed: number }> = ({ colors, speed }) => {
  const gradient = `linear-gradient(-45deg, ${colors.join(", ")})`;
  
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background: gradient,
        backgroundSize: "400% 400%",
      }}
      animate={{
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }}
      transition={{
        duration: speed,
        ease: "easeInOut",
        repeat: Infinity,
      }}
    />
  );
};

// 메시 그라디언트 배경
const MeshBackground: React.FC<{ colors: string[] }> = ({ colors }) => {
  return (
    <div className="absolute inset-0">
      {colors.map((color, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full mix-blend-multiply filter blur-3xl opacity-30"
          style={{
            background: color,
            width: `${30 + index * 10}%`,
            height: `${30 + index * 10}%`,
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 10 + index * 2,
            repeat: Infinity,
            ease: "linear",
            delay: index * 2,
          }}
        />
      ))}
    </div>
  );
};

// 오로라 배경
const AuroraBackground: React.FC<{ intensity: string }> = ({ intensity }) => {
  const opacityMap: Record<string, number> = {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
  };

  return (
    <div className="absolute inset-0">
      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at top, rgba(120, 230, 190, ${opacityMap[intensity]}), transparent 50%),
            radial-gradient(ellipse at bottom, rgba(255, 120, 160, ${opacityMap[intensity]}), transparent 50%),
            radial-gradient(ellipse at left, rgba(120, 160, 255, ${opacityMap[intensity]}), transparent 50%)
          `,
        }}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <svg className="absolute inset-0 w-full h-full">
        <filter id="aurora">
          <feTurbulence baseFrequency="0.02" numOctaves="4" seed="2" />
          <feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 1 0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#aurora)" opacity="0.3" />
      </svg>
    </div>
  );
};

// 별 배경
const StarsBackground: React.FC<{ intensity: string }> = ({ intensity }) => {
  const starCount: Record<string, number> = {
    low: 50,
    medium: 100,
    high: 200,
  };

  const stars = Array.from({ length: starCount[intensity] }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3,
    duration: Math.random() * 3 + 1,
  }));

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-purple-900 to-violet-900">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

// 웨이브 배경
const WavesBackground: React.FC<{ colors: string[]; intensity: string }> = ({ colors, intensity }) => {
  const waveSpeed: Record<string, number> = {
    low: 20,
    medium: 15,
    high: 10,
  };

  return (
    <div className="absolute inset-0">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((color, index) => (
              <stop
                key={index}
                offset={`${(index / (colors.length - 1)) * 100}%`}
                stopColor={color}
                stopOpacity="0.6"
              />
            ))}
          </linearGradient>
        </defs>
        {[0, 1, 2].map((index) => (
          <motion.path
            key={index}
            d="M0,100 C150,50 350,150 500,100 L500,200 L0,200 Z"
            fill="url(#wave-gradient)"
            opacity={0.4 - index * 0.1}
            animate={{
              d: [
                "M0,100 C150,50 350,150 500,100 L500,200 L0,200 Z",
                "M0,100 C150,150 350,50 500,100 L500,200 L0,200 Z",
                "M0,100 C150,50 350,150 500,100 L500,200 L0,200 Z",
              ],
            }}
            transition={{
              duration: waveSpeed[intensity],
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 2,
            }}
          />
        ))}
      </svg>
    </div>
  );
};