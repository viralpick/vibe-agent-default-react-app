import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ButtonPage } from "./pages/ui/button-page";
import { CheckboxPage } from "./pages/ui/checkbox-page";
import { BreadcrumbPage } from "./pages/ui/breadcrumb-page";
import { AccordionPage } from "./pages/ui/accordion-page";
import { BadgePage } from "./pages/ui/badge-page";
import { InputPage } from "./pages/ui/input-page";
import { TextareaPage } from "./pages/ui/textarea-page";
import { DatePickerPage } from "./pages/ui/date-picker-page";
import { TabsPage } from "./pages/ui/tabs-page";
import { DropdownPage } from "./pages/ui/dropdown-page";
import { CardPage } from "./pages/ui/card-page";
import { ProgressPage } from "./pages/ui/progress-page";
import { TooltipPage } from "./pages/ui/tooltip-page";
import { StatCardPage } from "./pages/ui/stat-card-page";
import PatternsPage from "./pages/patterns-page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioPage } from "./pages/ui/radio-page";

function UILayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract the tab value from the path (e.g., /ui/button -> button)
  const currentTab = location.pathname.split("/").pop() || "button";

  return (
    <div className="min-h-screen bg-background-0">
      <header className="sticky top-0 z-50 w-full border-b border-border-100 bg-background-0/80 backdrop-blur-md">
        <div className="flex h-64 items-center px-24 gap-24">
          <h1 className="text-h4 font-bold">COS Design System</h1>
          <Tabs 
            value={currentTab} 
            onValueChange={(val) => navigate(`/ui/${val}`)}
            variant="line"
            size="md"
          >
            <TabsList>
              <TabsTrigger value="button">Button</TabsTrigger>
              <TabsTrigger value="checkbox">Checkbox</TabsTrigger>
              <TabsTrigger value="breadcrumb">Breadcrumb</TabsTrigger>
              <TabsTrigger value="accordion">Accordion</TabsTrigger>
              <TabsTrigger value="badge">Badge</TabsTrigger>
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="textarea">Textarea</TabsTrigger>
              <TabsTrigger value="date-picker">DatePicker</TabsTrigger>
              <TabsTrigger value="tabs">Tabs</TabsTrigger>
              <TabsTrigger value="dropdown">Dropdown</TabsTrigger>
              <TabsTrigger value="card">Card</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="tooltip">Tooltip</TabsTrigger>
              <TabsTrigger value="stat-card">StatCard</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
              <TabsTrigger value="radio">Radio</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      <main className="p-24 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/ui/button" replace />} />
        <Route path="/ui" element={<Navigate to="/ui/button" replace />} />
        
        <Route path="/ui/button" element={<UILayout><ButtonPage /></UILayout>} />
        <Route path="/ui/checkbox" element={<UILayout><CheckboxPage /></UILayout>} />
        <Route path="/ui/breadcrumb" element={<UILayout><BreadcrumbPage /></UILayout>} />
        <Route path="/ui/accordion" element={<UILayout><AccordionPage /></UILayout>} />
        <Route path="/ui/badge" element={<UILayout><BadgePage /></UILayout>} />
        <Route path="/ui/input" element={<UILayout><InputPage /></UILayout>} />
        <Route path="/ui/textarea" element={<UILayout><TextareaPage /></UILayout>} />
        <Route path="/ui/date-picker" element={<UILayout><DatePickerPage /></UILayout>} />
        <Route path="/ui/tabs" element={<UILayout><TabsPage /></UILayout>} />
        <Route path="/ui/dropdown" element={<UILayout><DropdownPage /></UILayout>} />
        <Route path="/ui/card" element={<UILayout><CardPage /></UILayout>} />
        <Route path="/ui/progress" element={<UILayout><ProgressPage /></UILayout>} />
        <Route path="/ui/tooltip" element={<UILayout><TooltipPage /></UILayout>} />
        <Route path="/ui/stat-card" element={<UILayout><StatCardPage /></UILayout>} />
        <Route path="/ui/patterns" element={<UILayout><PatternsPage /></UILayout>} />
        <Route path="/ui/radio" element={<UILayout><RadioPage /></UILayout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
