"use client";

import React from "react";
import { motion, MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassmorphicCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
  blur?: "sm" | "md" | "lg" | "xl";
  border?: boolean;
  hover?: boolean;
  gradient?: boolean;
}

const blurValues = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
};

export const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  children,
  className,
  variant = "light",
  blur = "md",
  border = true,
  hover = true,
  gradient = false,
  ...motionProps
}) => {
  const baseClasses = cn(
    "relative overflow-hidden rounded-xl p-6",
    blurValues[blur],
    {
      "bg-white/10": variant === "light",
      "bg-black/30": variant === "dark",
      "border border-white/20": border && variant === "light",
      "border border-white/10": border && variant === "dark",
      "transition-all duration-300": hover,
      "hover:bg-white/15 hover:shadow-xl hover:scale-[1.02]": hover && variant === "light",
      "hover:bg-black/40 hover:shadow-xl hover:scale-[1.02]": hover && variant === "dark",
    },
    className
  );

  return (
    <motion.div
      className={baseClasses}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      {...motionProps}
    >
      {gradient && (
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10" />
        </div>
      )}
      
      {/* 글래스 이펙트 오버레이 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5" />
      </div>
      
      {/* 빛 반사 효과 */}
      <motion.div
        className="absolute -inset-1 -z-10 opacity-0"
        animate={{
          opacity: [0, 0.5, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12" />
      </motion.div>
      
      {children}
    </motion.div>
  );
};

// 사전 정의된 스타일 변형
export const GlassmorphicCardVariants = {
  default: "bg-white/10 backdrop-blur-md border border-white/20",
  dark: "bg-black/30 backdrop-blur-md border border-white/10",
  colorful: "bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 backdrop-blur-md border border-white/20",
  subtle: "bg-white/5 backdrop-blur-sm border border-white/10",
  strong: "bg-white/20 backdrop-blur-xl border border-white/30",
};