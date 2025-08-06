"use client";

import React from "react";
import { motion, MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface NeonButtonProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  color?: "pink" | "blue" | "purple" | "green" | "yellow" | "orange";
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  pulse?: boolean;
  flicker?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

const colorClasses = {
  pink: {
    text: "text-neon-pink",
    bg: "bg-neon-pink/20",
    border: "border-neon-pink",
    hover: "hover:bg-neon-pink/30",
    shadow: "shadow-[0_0_20px_rgba(255,16,240,0.5)]",
  },
  blue: {
    text: "text-neon-blue",
    bg: "bg-neon-blue/20",
    border: "border-neon-blue",
    hover: "hover:bg-neon-blue/30",
    shadow: "shadow-[0_0_20px_rgba(0,255,240,0.5)]",
  },
  purple: {
    text: "text-neon-purple",
    bg: "bg-neon-purple/20",
    border: "border-neon-purple",
    hover: "hover:bg-neon-purple/30",
    shadow: "shadow-[0_0_20px_rgba(157,0,255,0.5)]",
  },
  green: {
    text: "text-neon-green",
    bg: "bg-neon-green/20",
    border: "border-neon-green",
    hover: "hover:bg-neon-green/30",
    shadow: "shadow-[0_0_20px_rgba(0,255,136,0.5)]",
  },
  yellow: {
    text: "text-neon-yellow",
    bg: "bg-neon-yellow/20",
    border: "border-neon-yellow",
    hover: "hover:bg-neon-yellow/30",
    shadow: "shadow-[0_0_20px_rgba(255,215,0,0.5)]",
  },
  orange: {
    text: "text-neon-orange",
    bg: "bg-neon-orange/20",
    border: "border-neon-orange",
    hover: "hover:bg-neon-orange/30",
    shadow: "shadow-[0_0_20px_rgba(255,107,53,0.5)]",
  },
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
  xl: "px-8 py-4 text-xl",
};

export const NeonButton: React.FC<NeonButtonProps> = ({
  children,
  className,
  color = "blue",
  variant = "solid",
  size = "md",
  pulse = false,
  flicker = false,
  onClick,
  disabled = false,
  type = "button",
  ...motionProps
}) => {
  const colorClass = colorClasses[color];
  
  const baseClasses = cn(
    "relative font-bold rounded-lg transition-all duration-300",
    "transform active:scale-95",
    sizeClasses[size],
    colorClass.text,
    {
      // Solid variant
      [cn(colorClass.bg, colorClass.border, "border-2", colorClass.hover)]: variant === "solid",
      // Outline variant
      [cn("bg-transparent", colorClass.border, "border-2", colorClass.hover)]: variant === "outline",
      // Ghost variant
      [cn("bg-transparent", colorClass.hover)]: variant === "ghost",
      // Effects
      "animate-neon-pulse": pulse,
      "animate-neon-flicker": flicker,
      // Disabled state
      "opacity-50 cursor-not-allowed": disabled,
      "cursor-pointer": !disabled,
    },
    className
  );

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <motion.button
      type={type}
      className={baseClasses}
      onClick={handleClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      {...motionProps}
    >
      {/* 네온 글로우 효과 */}
      <span
        className={cn(
          "absolute inset-0 rounded-lg blur-md opacity-75",
          colorClass.bg,
          colorClass.shadow
        )}
        aria-hidden="true"
      />
      
      {/* 버튼 콘텐츠 */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
      
      {/* 호버시 추가 글로우 */}
      <motion.span
        className={cn(
          "absolute inset-0 rounded-lg opacity-0",
          colorClass.shadow
        )}
        animate={{
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        aria-hidden="true"
      />
    </motion.button>
  );
};

// 버튼 그룹 컴포넌트
export const NeonButtonGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
  direction?: "horizontal" | "vertical";
}> = ({ children, className, direction = "horizontal" }) => {
  return (
    <div
      className={cn(
        "flex gap-4",
        {
          "flex-row": direction === "horizontal",
          "flex-col": direction === "vertical",
        },
        className
      )}
    >
      {children}
    </div>
  );
};