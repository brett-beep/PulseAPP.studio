import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Settings } from "lucide-react";
import { createPageUrl } from "@/utils";

const tabs = [
  { to: createPageUrl("Home"), label: "Home", icon: Home },
  { to: createPageUrl("Settings"), label: "Settings", icon: Settings },
];

export default function MobileTabBar() {
  const location = useLocation();
  const path = location?.pathname || "/";

  // Keep the mobile shell minimal-risk: show tabs only on primary app pages.
  const showTabs = path === "/" || path === "/Home" || path === "/Settings";
  if (!showTabs) return null;

  return (
    <nav
      className="mobile-tabbar md:hidden"
      aria-label="Mobile bottom navigation"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))", userSelect: "none" }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `mobile-tabbar-item ${isActive ? "is-active" : ""}`
            }
            end={tab.to === "/" || tab.to === "/Home"}
          >
            <Icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

