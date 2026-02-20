import React from "react";
import { Home, Newspaper, Settings } from "lucide-react";

const tabs = [
  { id: "home", label: "Home", icon: Home },
  { id: "news", label: "News", icon: Newspaper },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function MobileTabBar({ activeTab = "home", onTabChange, newsCount = 0 }) {
  return (
    <nav
      className="mobile-tabbar md:hidden"
      aria-label="Mobile bottom navigation"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))", userSelect: "none" }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            className={`mobile-tabbar-item ${isActive ? "is-active" : ""}`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {tab.id === "news" && newsCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
