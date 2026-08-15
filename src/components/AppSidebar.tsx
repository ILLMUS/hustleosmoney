import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  KanbanSquare, 
  Wallet, 
  Settings, 
  LogOut, 
  Inbox, 
  Target, 
  ClipboardList, 
  CalendarClock, 
  UserCog, 
  BarChart3, 
  ChevronDown,
  BookOpenCheck,   // For Ledger Reports
  Receipt,         // For Invoices Hub
  Percent,         // For Tax Summaries
  SlidersHorizontal// For Accounting Settings
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/context/AuthContext";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "New document", url: "/create", icon: FileText },
  { title: "Task inbox", url: "/inbox", icon: Inbox },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
];

const crmItems = [
  { title: "All Leads", url: "/leads", icon: Target },
  { title: "Lead forms", url: "/lead-forms", icon: ClipboardList },
  { title: "Meetings", url: "/meetings", icon: CalendarClock },
  { title: "Sales team", url: "/team", icon: UserCog },
  { title: "Sales reports", url: "/sales-reports", icon: BarChart3 },
];

// Dedicated HustleOS Accounting Portal Items
const hustleOSItems = [
  { title: "Unpaid Invoices Hub", url: "/hustleos/invoices", icon: Receipt },
  { title: "Ledger Reports", url: "/hustleos/ledger", icon: BookOpenCheck },
  { title: "Tax Summaries", url: "/hustleos/taxes", icon: Percent },
  { title: "Accounting Settings", url: "/hustleos/settings", icon: SlidersHorizontal },
];

const bottomItems = [
  { title: "Money tracker", url: "/money-tracker", icon: Wallet },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const isCrmActive = crmItems.some(item => isActive(item.url));
  const isHustleOSActive = hustleOSItems.some(item => isActive(item.url));

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations & CRM</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Main SOP Items */}
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-2 hover:bg-muted/50">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Sales CRM & Leads Dropdown */}
              <Collapsible defaultOpen={isCrmActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="flex items-center justify-between w-full hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span>Sales CRM & Leads</span>
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {crmItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                            <NavLink to={subItem.url} className="flex items-center gap-2">
                              <subItem.icon className="h-3.5 w-3.5" />
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* HustleOS Accounting Portal Dropdown */}
              <Collapsible defaultOpen={isHustleOSActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="flex items-center justify-between w-full hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <BookOpenCheck className="h-4 w-4" />
                        <span>BusinessOS Financials</span>
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {hustleOSItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                            <NavLink to={subItem.url} className="flex items-center gap-2">
                              <subItem.icon className="h-3.5 w-3.5" />
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* General System Items */}
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2 hover:bg-muted/50">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer / Account Management */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => signOut()} className="flex items-center gap-2 hover:bg-muted/50">
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}