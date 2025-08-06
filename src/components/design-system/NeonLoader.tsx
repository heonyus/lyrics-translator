"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonLoaderProps {
  variant?: "spinner" | "pulse" | "dots" | "bars" | "ring";
  color?: "pink" | "blue" | "purple" | "green" | "yellow" | "orange";
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  className?: string;
}

const colorClasses = {
  pink: "text-neon-pink",
  blue: "text-neon-blue",
  purple: "text-neon-purple",
  green: "text-neon-green",
  yellow: "text-neon-yellow",
  orange: "text-neon-orange",
};

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

export const NeonLoader: React.FC<NeonLoaderProps> = ({
  variant = "spinner",
  color = "blue",
  size = "md",
  text,
  className,
}) => {
  const colorClass = colorClasses[color];
  const sizeClass = sizeClasses[size];

  const renderLoader = () => {
    switch (variant) {
      case "spinner":
        return <SpinnerLoader colorClass={colorClass} sizeClass={sizeClass} />;
      case "pulse":
        return <PulseLoader colorClass={colorClass} sizeClass={sizeClass} />;
      case "dots":
        return <DotsLoader colorClass={colorClass} />;
      case "bars":
        return <BarsLoader colorClass={colorClass} />;
      case "ring":
        return <RingLoader colorClass={colorClass} sizeClass={sizeClass} />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      {renderLoader()}
      {text && (
        <motion.p
          className={cn("text-lg font-semibold", colorClass)}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

// 스피너 로더
const SpinnerLoader: React.FC<{ colorClass: string; sizeClass: string }> = ({ colorClass, sizeClass }) => (
  <motion.div
    className={cn(sizeClass, colorClass)}
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  >
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75 neon-text"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </motion.div>
);

// 펄스 로더
const PulseLoader: React.FC<{ colorClass: string; sizeClass: string }> = ({ colorClass, sizeClass }) => (
  <div className="relative">
    <motion.div
      className={cn(sizeClass, colorClass, "rounded-full neon-box")}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [1, 0.5, 1],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
    <motion.div
      className={cn(sizeClass, colorClass, "rounded-full absolute inset-0 neon-box")}
      animate={{
        scale: [1, 1.5, 1],
        opacity: [0.5, 0, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: 0.2,
      }}
    />
  </div>
);

// 점 로더
const DotsLoader: React.FC<{ colorClass: string }> = ({ colorClass }) => (
  <div className="flex gap-2">
    {[0, 1, 2].map((index) => (
      <motion.div
        key={index}
        className={cn("w-4 h-4 rounded-full", colorClass, "neon-box")}
        animate={{
          y: [0, -20, 0],
          opacity: [1, 0.5, 1],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          delay: index * 0.2,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// 바 로더
const BarsLoader: React.FC<{ colorClass: string }> = ({ colorClass }) => (
  <div className="flex gap-1">
    {[0, 1, 2, 3, 4].map((index) => (
      <motion.div
        key={index}
        className={cn("w-1 bg-current", colorClass, "neon-text")}
        animate={{
          height: ["20px", "40px", "20px"],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          delay: index * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// 링 로더
const RingLoader: React.FC<{ colorClass: string; sizeClass: string }> = ({ colorClass, sizeClass }) => (
  <div className={cn("relative", sizeClass)}>
    <motion.div
      className={cn("absolute inset-0 rounded-full border-4 border-current", colorClass, "neon-border")}
      animate={{
        rotate: 360,
        scale: [1, 1.1, 1],
      }}
      transition={{
        rotate: { duration: 2, repeat: Infinity, ease: "linear" },
        scale: { duration: 1, repeat: Infinity, ease: "easeInOut" },
      }}
    />
    <motion.div
      className={cn("absolute inset-2 rounded-full border-4 border-current", colorClass, "neon-border")}
      animate={{
        rotate: -360,
        scale: [1, 0.9, 1],
      }}
      transition={{
        rotate: { duration: 3, repeat: Infinity, ease: "linear" },
        scale: { duration: 1, repeat: Infinity, ease: "easeInOut" },
      }}
    />
  </div>
);