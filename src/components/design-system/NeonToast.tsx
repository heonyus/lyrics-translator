"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NeonToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    color: "text-neon-green",
    bgColor: "bg-neon-green/10",
    borderColor: "border-neon-green/50",
  },
  error: {
    icon: AlertCircle,
    color: "text-neon-pink",
    bgColor: "bg-neon-pink/10",
    borderColor: "border-neon-pink/50",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-neon-yellow",
    bgColor: "bg-neon-yellow/10",
    borderColor: "border-neon-yellow/50",
  },
  info: {
    icon: Info,
    color: "text-neon-blue",
    bgColor: "bg-neon-blue/10",
    borderColor: "border-neon-blue/50",
  },
};

export const NeonToast: React.FC<NeonToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const config = typeConfig[toast.type || "info"];
  const Icon = config.icon;

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(toast.id), 300);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "relative flex items-start gap-3 p-4 rounded-lg",
            "backdrop-blur-md border",
            config.bgColor,
            config.borderColor,
            "shadow-lg",
            "min-w-[300px] max-w-[500px]"
          )}
        >
          {/* 네온 글로우 효과 */}
          <div
            className={cn(
              "absolute inset-0 rounded-lg blur-md opacity-30",
              config.bgColor
            )}
            aria-hidden="true"
          />

          {/* 아이콘 */}
          <div className={cn("relative z-10 mt-0.5", config.color)}>
            <Icon className="w-5 h-5 neon-text" />
          </div>

          {/* 콘텐츠 */}
          <div className="relative z-10 flex-1">
            <h3 className={cn("font-semibold text-white", config.color)}>
              {toast.title}
            </h3>
            {toast.description && (
              <p className="mt-1 text-sm text-gray-300">{toast.description}</p>
            )}
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className={cn(
                  "mt-2 text-sm font-medium",
                  config.color,
                  "hover:underline focus:outline-none"
                )}
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={handleClose}
            className={cn(
              "relative z-10 p-1 rounded-md transition-colors",
              "hover:bg-white/10",
              "focus:outline-none focus:ring-2 focus:ring-white/20"
            )}
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>

          {/* 진행 바 (duration이 있을 때만) */}
          {toast.duration && (
            <motion.div
              className={cn(
                "absolute bottom-0 left-0 h-1 rounded-b-lg",
                config.bgColor.replace("/10", "/50")
              )}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: toast.duration / 1000, ease: "linear" }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// 토스트 컨테이너 컴포넌트
interface NeonToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
}

export const NeonToastContainer: React.FC<NeonToastContainerProps> = ({
  toasts,
  onClose,
  position = "top-right",
}) => {
  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
    "bottom-right": "bottom-4 right-4",
  };

  return (
    <div className={cn("fixed z-50", positionClasses[position])}>
      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <NeonToast key={toast.id} toast={toast} onClose={onClose} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// 토스트 훅
export const useNeonToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };
    setToasts((prev) => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (title: string, description?: string, duration?: number) => {
    return addToast({ title, description, type: "success", duration });
  };

  const error = (title: string, description?: string, duration?: number) => {
    return addToast({ title, description, type: "error", duration });
  };

  const warning = (title: string, description?: string, duration?: number) => {
    return addToast({ title, description, type: "warning", duration });
  };

  const info = (title: string, description?: string, duration?: number) => {
    return addToast({ title, description, type: "info", duration });
  };

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
};