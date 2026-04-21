/**
 * Synapse Component Full Verification Page
 *
 * 사용법: src/App.tsx를 이 파일로 교체하고 localhost:3001에서 확인
 *   cp src/App.synapse-test.tsx src/App.tsx
 *
 * 검증 범위: @enhans/synapse 전체 컴포넌트 + @enhans/synapse/charts + @enhans/synapse/data-table
 * Maps 제외 (별도 의존성 필요)
 *
 * 검증 업데이트: 2026-04-21
 */
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
    // Basic
    Button,
    Badge,
    Checkbox,
    RadioGroup,
    RadioGroupItem,
    Switch,
    Spinner,
    Skeleton,
    Separator,
    Progress,
    Label,
    Dot,
    Slider,
    Stepper,
    // Layout
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardAction,
    CardContent,
    CardFooter,
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbDivider,
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetClose,
    // Overlay
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
    Popover,
    PopoverTrigger,
    PopoverContent,
    // Data Entry
    Input,
    Textarea,
    Select,
    MultiSelect,
    Combobox,
    Autocomplete,
    CascadingSelect,
    Calendar,
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    // DatePicker (composition pattern)
    DatePickerProvider,
    DatePickerField,
    DatePickerPopover,
    // Form
    FormField,
    FormSection,
    // Data Display
    Notification,
    Alert,
    AlertTitle,
    AlertDescription,
    Chip,
    Pagination,
    Avatar,
    AvatarImage,
    AvatarFallback,
    PivotTable,
    // Layout & Utility
    EmptyState,
    WidgetGrid,
    WidgetGridItem,
    CollapsibleSection,
    LoadingOverlay,
    ConfirmDialog,
    ApiActionButton,
    // Advanced
    DynamicTabs,
    SortableList,
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
    ThemeSwitcher,
    ConditionalRenderer,
    HierarchicalFilter,
    FilterPreset,
    WhatIfPanel,
    // Utility
    cn,
} from "@enhans/synapse";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import {
    KpiCard,
    BarChart,
    LineChart,
    AreaChart,
    PieChart,
    ScatterChart,
    HeatmapChart,
    TreemapChart,
    GaugeChart,
    WaterfallChart,
    FunnelChart,
    SparklineChart,
    ChartContainer,
} from "@enhans/synapse/charts";
import { Search, Plus, FileText, TrendingUp, Settings, Home, ChevronRight, Trash2, GripVertical } from "lucide-react";

// ═══ TEST DATA ═══

const tableData = [
    { id: 1, name: "Alice", email: "alice@test.com", role: "Admin" },
    { id: 2, name: "Bob", email: "bob@test.com", role: "User" },
    { id: 3, name: "Charlie", email: "charlie@test.com", role: "Editor" },
];

type Person = (typeof tableData)[number];

const columns: ColumnDef<Person>[] = [
    { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Name" /> },
    { accessorKey: "email", header: ({ column }) => <DataTableColumnHeader column={column} title="Email" /> },
    { accessorKey: "role", header: ({ column }) => <DataTableColumnHeader column={column} title="Role" /> },
];

const selectOptions = [
    { value: "opt1", label: "Option 1" },
    { value: "opt2", label: "Option 2" },
    { value: "opt3", label: "Option 3" },
];

const comboboxOptions = [
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "angular", label: "Angular" },
    { value: "svelte", label: "Svelte" },
];

const cascadingLevels = [
    { id: "country", label: "국가", placeholder: "국가 선택", options: [{ value: "kr", label: "한국" }, { value: "us", label: "미국" }] },
    { id: "city", label: "도시", placeholder: "도시 선택", options: [{ value: "seoul", label: "서울" }, { value: "busan", label: "부산" }] },
];

const autocompleteOptions = [
    { value: "apple", label: "Apple", description: "과일" },
    { value: "banana", label: "Banana", description: "과일" },
    { value: "carrot", label: "Carrot", description: "채소" },
];

const treeData = [
    { id: "1", label: "전자제품", count: 42, children: [
        { id: "1-1", label: "스마트폰", count: 20 },
        { id: "1-2", label: "노트북", count: 22 },
    ]},
    { id: "2", label: "의류", count: 35 },
];

const filterPresets = [
    { id: "p1", label: "최근 7일", filters: { days: 7 } },
    { id: "p2", label: "최근 30일", filters: { days: 30 } },
];

const themeOptions = [
    { id: "light", label: "라이트" },
    { id: "dark", label: "다크" },
    { id: "system", label: "시스템" },
];

const whatIfParams = [
    { id: "price", label: "가격", type: "slider" as const, value: 50, min: 0, max: 100, step: 1, unit: "%" },
    { id: "quantity", label: "수량", type: "number" as const, value: 100, min: 0, max: 1000 },
];

const dynamicTabsData = [
    { id: "tab1", label: "탭 1", closable: true },
    { id: "tab2", label: "탭 2", closable: true },
];

const sortableItems = [
    { id: "s1", label: "항목 A" },
    { id: "s2", label: "항목 B" },
    { id: "s3", label: "항목 C" },
];

const CHART_COLORS = ["#e2622d", "#2a9d8f", "#3d5a80", "#e9c46a", "#f4a261"];

const barChartData = [
    { month: "Jan", revenue: 4200 },
    { month: "Feb", revenue: 5800 },
    { month: "Mar", revenue: 3100 },
    { month: "Apr", revenue: 6700 },
    { month: "May", revenue: 5200 },
];

const lineChartData = [
    { date: "04-01", count: 12, score: 4.2 },
    { date: "04-05", count: 18, score: 3.8 },
    { date: "04-10", count: 25, score: 4.5 },
    { date: "04-15", count: 15, score: 4.1 },
    { date: "04-20", count: 22, score: 4.6 },
];

const pieChartData = [
    { name: "긍정", value: 65 },
    { name: "중립", value: 20 },
    { name: "부정", value: 15 },
];

const areaChartData = [
    { date: "04-01", value: 100 },
    { date: "04-05", value: 150 },
    { date: "04-10", value: 120 },
    { date: "04-15", value: 200 },
    { date: "04-20", value: 180 },
];

const scatterData = [
    { x: 10, y: 20, size: 5 },
    { x: 30, y: 40, size: 15 },
    { x: 50, y: 10, size: 25 },
    { x: 70, y: 60, size: 10 },
    { x: 90, y: 30, size: 20 },
];

const heatmapData = [
    { x: "Mon", y: "Morning", value: 10 },
    { x: "Mon", y: "Afternoon", value: 20 },
    { x: "Tue", y: "Morning", value: 30 },
    { x: "Tue", y: "Afternoon", value: 15 },
    { x: "Wed", y: "Morning", value: 25 },
    { x: "Wed", y: "Afternoon", value: 35 },
];

const treemapData = [
    { name: "A", value: 100, children: [{ name: "A1", value: 60 }, { name: "A2", value: 40 }] },
    { name: "B", value: 80 },
    { name: "C", value: 50 },
];

const waterfallData = [
    { category: "시작", value: 1000, type: "total" },
    { category: "매출", value: 500, type: "increase" },
    { category: "비용", value: -200, type: "decrease" },
    { category: "세금", value: -100, type: "decrease" },
    { category: "최종", value: 1200, type: "total" },
];

const funnelData = [
    { stage: "방문", count: 1000 },
    { stage: "관심", count: 600 },
    { stage: "장바구니", count: 300 },
    { stage: "구매", count: 100 },
];

const pivotResult = {
    rows: ["A", "B"],
    columns: ["Q1", "Q2"],
    values: [[100, 200], [150, 250]],
    rowTotals: [300, 400],
    columnTotals: [250, 450],
    grandTotal: 700,
};

const sparklineData = [10, 20, 15, 30, 25, 35, 28];

// ═══ HELPERS ═══

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
    return (
        <div className="mb-8" id={id}>
            <h2 className="text-h3 mb-4 text-text-primary">{title}</h2>
            <div className="flex flex-wrap gap-4 items-start">{children}</div>
        </div>
    );
}

function StateDisplay({ label, value }: { label: string; value: string }) {
    return (
        <div className="text-caption-1 px-2 py-1 rounded-medium bg-background-brand-light text-text-brand font-mono">
            🔵 {label}: <strong>{value}</strong>
        </div>
    );
}

// ═══ MAIN APP ═══

export default function App() {
    // Basic states
    const [checked, setChecked] = useState(false);
    const [switchOn, setSwitchOn] = useState(false);
    const [radioVal, setRadioVal] = useState("a");
    const [selectVal, setSelectVal] = useState("opt1");
    const [multiSelectVals, setMultiSelectVals] = useState<string[]>(["opt1"]);
    const [inputVal, setInputVal] = useState("");
    const [textareaVal, setTextareaVal] = useState("");
    const [paginationPage, setPaginationPage] = useState(1);
    const [clickCount, setClickCount] = useState(0);
    const [sliderVal, setSliderVal] = useState([50]);
    const [stepperVal, setStepperVal] = useState(3);

    // DatePicker states
    const [singleDate, setSingleDate] = useState<Date | null>(null);
    const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        return { start, end };
    });

    // Advanced states
    const [comboVals, setComboVals] = useState<string[]>([]);
    const [autoVal, setAutoVal] = useState("");
    const [cascadeVals, setCascadeVals] = useState<Record<string, string>>({});
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
    const [treeFilterVal, setTreeFilterVal] = useState<string[]>([]);
    const [activePreset, setActivePreset] = useState<string | undefined>();
    const [themeVal, setThemeVal] = useState("light");
    const [dynamicTabs, setDynamicTabs] = useState(dynamicTabsData);
    const [activeTabId, setActiveTabId] = useState("tab1");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loadingDemo, setLoadingDemo] = useState(false);

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-background-0 p-6 max-w-[1200px] mx-auto">
                <h1 className="text-h1 mb-2 text-text-primary">Synapse Full Component Verification</h1>
                <p className="text-body-3 text-text-secondary mb-8">~75 components · Maps 제외</p>

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION A: BASIC COMPONENTS (1-14)         */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">A. Basic Components</h2>

                <Section title="1. Button">
                    <Button buttonStyle="primary" size="md" onClick={() => setClickCount(c => c + 1)}>Primary ({clickCount})</Button>
                    <Button buttonStyle="secondary" size="md">Secondary</Button>
                    <Button buttonStyle="tertiary" size="sm">Tertiary SM</Button>
                    <Button buttonStyle="ghost" size="xs">Ghost XS</Button>
                    <Button buttonStyle="primary" target="destructive" size="md">Destructive</Button>
                    <Button buttonStyle="primary" target="brand" size="md">Brand</Button>
                    <Button buttonStyle="primary" size="md" disabled>Disabled</Button>
                    <Button buttonStyle="primary" size="md" leadIcon={<Search />}>With Icon</Button>
                    <Button buttonStyle="primary" buttonType="icon" size="md"><Plus /></Button>
                </Section>

                <Section title="2. Badge">
                    <Badge theme="blue" badgeStyle="filled" size="md">Blue Filled</Badge>
                    <Badge theme="red" badgeStyle="light" size="sm">Red Light</Badge>
                    <Badge theme="green" shape="pill" size="lg">Green Pill</Badge>
                    <Badge theme="purple" outline size="md">Purple Outline</Badge>
                    <Badge theme="yellow" badgeStyle="filled" size="md">Yellow</Badge>
                    <Badge theme="slate" badgeStyle="filled" size="md">Slate</Badge>
                    <Badge theme="gray" badgeStyle="filled" size="md">Gray</Badge>
                </Section>

                <Section title="3. Checkbox">
                    <div className="flex items-center gap-2">
                        <Checkbox size="md" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                        <Label>Toggle me</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox size="sm" checked="indeterminate" disabled />
                        <Label>Indeterminate</Label>
                    </div>
                    <StateDisplay label="checked" value={String(checked)} />
                </Section>

                <Section title="4. RadioGroup">
                    <RadioGroup value={radioVal} onValueChange={setRadioVal}>
                        <div className="flex items-center gap-2"><RadioGroupItem value="a" /><Label>A</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="b" /><Label>B</Label></div>
                    </RadioGroup>
                    <StateDisplay label="radioVal" value={radioVal} />
                </Section>

                <Section title="5. Switch">
                    <Switch size="md" switchStyle="brand" label="Brand" checked={switchOn} onCheckedChange={setSwitchOn} />
                    <Switch size="sm" label="Small" />
                    <Switch size="md" label="Disabled" disabled />
                </Section>

                <Section title="6. Spinner">
                    <Spinner size="default" /><Spinner size="sm" /><Spinner size="xs" />
                </Section>

                <Section title="7. Skeleton">
                    <Skeleton className="h-8 w-48 rounded-md" />
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-12 w-12 rounded-full" />
                </Section>

                <Section title="8. Separator">
                    <div className="w-full">
                        <p className="text-body-2 text-text-secondary">Above</p>
                        <Separator orientation="horizontal" className="my-2" />
                        <p className="text-body-2 text-text-secondary">Below</p>
                    </div>
                </Section>

                <Section title="9. Progress">
                    <div className="w-64"><Progress value={65} max={100}><Progress.Bar size="md" /></Progress></div>
                    <div className="w-24"><Progress value={65} max={100}><Progress.Circle size="md" /></Progress></div>
                </Section>

                <Section title="10. Dot">
                    <Dot size="small" color="gray" />
                    <Dot size="medium" color="green" />
                    <Dot size="large" color="red" />
                    <Dot size="xlarge" color="blue" />
                </Section>

                <Section title="11. Label">
                    <Label>Normal</Label>
                    <Label required>Required</Label>
                </Section>

                <Section title="12. Slider">
                    <div className="w-64">
                        <Slider value={sliderVal} onValueChange={setSliderVal} min={0} max={100} step={1} />
                    </div>
                    <StateDisplay label="slider" value={String(sliderVal[0])} />
                </Section>

                <Section title="13. Stepper">
                    <Stepper value={stepperVal} onValueChange={setStepperVal} min={0} max={10} step={1} />
                    <StateDisplay label="stepper" value={String(stepperVal)} />
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION B: LAYOUT COMPONENTS (14-20)       */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">B. Layout Components</h2>

                <Section title="14. Card">
                    <Card className="w-80">
                        <CardHeader>
                            <CardTitle>Card Title</CardTitle>
                            <CardDescription>Description</CardDescription>
                            <CardAction><Button buttonStyle="ghost" size="xs">Action</Button></CardAction>
                        </CardHeader>
                        <CardContent><p className="text-body-2 text-text-secondary">Content</p></CardContent>
                        <CardFooter><Button buttonStyle="primary" size="sm">Footer</Button></CardFooter>
                    </Card>
                </Section>

                <Section title="15. Tabs">
                    <Tabs defaultValue="tab1" variant="segmented" className="w-96">
                        <TabsList>
                            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                        </TabsList>
                        <TabsContent value="tab1"><p className="text-body-2 p-4">Content 1</p></TabsContent>
                        <TabsContent value="tab2"><p className="text-body-2 p-4">Content 2</p></TabsContent>
                    </Tabs>
                </Section>

                <Section title="16. Accordion">
                    <Accordion type="single" collapsible className="w-96">
                        <AccordionItem value="1">
                            <AccordionTrigger>Section 1</AccordionTrigger>
                            <AccordionContent>Content 1</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="2">
                            <AccordionTrigger>Section 2</AccordionTrigger>
                            <AccordionContent>Content 2</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </Section>

                <Section title="17. Table">
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {tableData.slice(0, 2).map(r => (
                                <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell>{r.email}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Section>

                <Section title="18. Breadcrumb">
                    <Breadcrumb>
                        <BreadcrumbItem icon={<Home className="size-4" />} href="#">Home</BreadcrumbItem>
                        <BreadcrumbDivider />
                        <BreadcrumbItem href="#">Products</BreadcrumbItem>
                        <BreadcrumbDivider />
                        <BreadcrumbItem isLast>Detail</BreadcrumbItem>
                    </Breadcrumb>
                </Section>

                <Section title="19. Sheet">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button buttonStyle="secondary" size="md">Open Sheet</Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                            <SheetHeader>
                                <SheetTitle>Sheet Title</SheetTitle>
                                <SheetDescription>Sheet description</SheetDescription>
                            </SheetHeader>
                            <p className="text-body-2 text-text-secondary py-4">Sheet content here.</p>
                            <SheetFooter>
                                <SheetClose asChild><Button buttonStyle="secondary" size="md">Close</Button></SheetClose>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                </Section>

                <Section title="20. Separator (vertical)">
                    <div className="flex items-center h-8 gap-4">
                        <span className="text-body-2">Left</span>
                        <Separator orientation="vertical" />
                        <span className="text-body-2">Right</span>
                    </div>
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION C: OVERLAY COMPONENTS (21-23)      */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">C. Overlay Components</h2>

                <Section title="21. Dialog">
                    <Dialog>
                        <DialogTrigger asChild><Button buttonStyle="primary" size="md">Open Dialog</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Dialog Title</DialogTitle><DialogDescription>Description</DialogDescription></DialogHeader>
                            <p className="text-body-2 py-4">Content</p>
                            <DialogFooter>
                                <DialogClose asChild><Button buttonStyle="secondary" size="md">Cancel</Button></DialogClose>
                                <Button buttonStyle="primary" size="md">Confirm</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </Section>

                <Section title="22. Tooltip">
                    <Tooltip>
                        <TooltipTrigger asChild><Button buttonStyle="secondary" size="md">Hover me</Button></TooltipTrigger>
                        <TooltipContent side="top" size="md">Tooltip text</TooltipContent>
                    </Tooltip>
                </Section>

                <Section title="23. Popover">
                    <Popover>
                        <PopoverTrigger asChild><Button buttonStyle="secondary" size="md">Open Popover</Button></PopoverTrigger>
                        <PopoverContent><p className="text-body-2">Popover content</p></PopoverContent>
                    </Popover>
                </Section>

                <Section title="24. ConfirmDialog">
                    <Button buttonStyle="primary" target="destructive" size="md" onClick={() => setConfirmOpen(true)}>Delete Item</Button>
                    <ConfirmDialog
                        open={confirmOpen}
                        onOpenChange={setConfirmOpen}
                        title="삭제 확인"
                        description="정말 삭제하시겠습니까?"
                        onConfirm={() => { setConfirmOpen(false); }}
                    />
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION D: DATA ENTRY (25-36)              */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">D. Data Entry Components</h2>

                <Section title="25. Input">
                    <Input size="md" placeholder="Default" value={inputVal} onChange={(e) => setInputVal(e.target.value)} />
                    <Input size="sm" placeholder="With icon" leadIcon={<Search />} />
                    <Input size="md" placeholder="Disabled" disabled />
                </Section>

                <Section title="26. Textarea">
                    <div className="w-80">
                        <Textarea placeholder="Write..." value={textareaVal} onChange={(e) => setTextareaVal(e.target.value)} />
                    </div>
                </Section>

                <Section title="27. Select">
                    <Select options={selectOptions} value={selectVal} onValueChange={setSelectVal} placeholder="Choose..." />
                    <StateDisplay label="select" value={selectVal} />
                </Section>

                <Section title="28. MultiSelect">
                    <MultiSelect options={selectOptions} values={multiSelectVals} onValuesChange={setMultiSelectVals} placeholder="Multi..." />
                    <StateDisplay label="multiSelect" value={multiSelectVals.join(",")} />
                </Section>

                <Section title="29. Combobox">
                    <Combobox options={comboboxOptions} values={comboVals} onValuesChange={setComboVals} placeholder="Search frameworks..." />
                    <StateDisplay label="combobox" value={comboVals.join(",")} />
                </Section>

                <Section title="30. Autocomplete">
                    <Autocomplete options={autocompleteOptions} value={autoVal} onValueChange={setAutoVal} placeholder="Type to search..." />
                    <StateDisplay label="autocomplete" value={autoVal} />
                </Section>

                <Section title="31. CascadingSelect">
                    <CascadingSelect levels={cascadingLevels} values={cascadeVals} onValuesChange={setCascadeVals} direction="horizontal" />
                    <StateDisplay label="cascade" value={JSON.stringify(cascadeVals)} />
                </Section>

                <Section title="32. Calendar">
                    <div className="border border-border-100 rounded-large p-2 w-fit">
                        <Calendar mode="single" selected={calendarDate} onSelect={setCalendarDate} />
                    </div>
                    <StateDisplay label="date" value={calendarDate?.toISOString().slice(0, 10) ?? "null"} />
                </Section>

                <Section title="33. Command">
                    <div className="w-80 border border-border-100 rounded-large">
                        <Command>
                            <CommandInput placeholder="검색..." />
                            <CommandList>
                                <CommandEmpty>결과 없음</CommandEmpty>
                                <CommandGroup heading="과일">
                                    <CommandItem>🍎 사과</CommandItem>
                                    <CommandItem>🍌 바나나</CommandItem>
                                </CommandGroup>
                                <CommandGroup heading="채소">
                                    <CommandItem>🥕 당근</CommandItem>
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </div>
                </Section>

                <Section title="34. DatePicker single (composition)">
                    <DatePickerProvider type="single" value={singleDate} onValueChange={setSingleDate}>
                        <DatePickerPopover>
                            <DatePickerField size="md" placeholder="Pick a date" />
                        </DatePickerPopover>
                    </DatePickerProvider>
                    <StateDisplay label="singleDate" value={singleDate?.toISOString().slice(0, 10) ?? "null"} />
                </Section>

                <Section title="35. DatePicker range + presets (composition)">
                    <DatePickerProvider type="range" rangeValue={dateRange} onRangeValueChange={(r) => r && setDateRange(r)}>
                        <DatePickerPopover showPresets>
                            <DatePickerField size="md" placeholder="Pick range" className="w-[260px]" />
                        </DatePickerPopover>
                    </DatePickerProvider>
                    <StateDisplay label="range" value={dateRange ? `${dateRange.start.toISOString().slice(0, 10)} ~ ${dateRange.end.toISOString().slice(0, 10)}` : "null"} />
                </Section>

                <Section title="36. FormField + FormSection">
                    <FormSection title="사용자 정보" columns={2}>
                        <FormField label="이름" required>
                            <Input size="md" placeholder="이름 입력" />
                        </FormField>
                        <FormField label="이메일" description="업무용 이메일" error="필수 항목입니다">
                            <Input size="md" placeholder="email@example.com" />
                        </FormField>
                    </FormSection>
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION E: DATA DISPLAY (37-45)            */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">E. Data Display Components</h2>

                <Section title="37. DataTable">
                    <div className="w-full">
                        <DataTable data={tableData} columns={columns}>
                            <DataTable.Body />
                            <DataTable.Pagination />
                        </DataTable>
                    </div>
                </Section>

                <Section title="38. Notification">
                    <div className="w-96">
                        <Notification status="success" layout="expanded">
                            <Notification.Icon /><Notification.Title>Success</Notification.Title>
                            <Notification.Description>Operation completed.</Notification.Description>
                        </Notification>
                    </div>
                    <div className="w-96">
                        <Notification status="error" layout="compact">
                            <Notification.Icon /><Notification.Title>Error</Notification.Title>
                        </Notification>
                    </div>
                </Section>

                <Section title="39. Alert">
                    <div className="w-96"><Alert><AlertTitle>Default</AlertTitle><AlertDescription>Info message</AlertDescription></Alert></div>
                    <div className="w-96"><Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Something wrong</AlertDescription></Alert></div>
                </Section>

                <Section title="40. Chip">
                    <Chip size="md">Default</Chip>
                    <Chip size="sm" onRemove={() => {}}>Removable</Chip>
                    <Chip size="md" shape="pill">Pill</Chip>
                </Section>

                <Section title="41. Pagination">
                    <Pagination page={paginationPage} totalPages={10} onPageChange={setPaginationPage}>
                        <Pagination.Direction direction="prev" />
                        <Pagination.Numbers />
                        <Pagination.Direction direction="next" />
                    </Pagination>
                    <StateDisplay label="page" value={String(paginationPage)} />
                </Section>

                <Section title="42. Avatar">
                    <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
                    <Avatar><AvatarImage src="https://via.placeholder.com/40" /><AvatarFallback>AB</AvatarFallback></Avatar>
                </Section>

                <Section title="43. PivotTable (temporarily disabled)">
                    <p className="text-body-3 text-text-tertiary">PivotTable: 데이터 형식 확인 필요</p>
                </Section>

                <Section title="44. Toast (v0.10+ only — skipped)">
                    <p className="text-body-3 text-text-tertiary">Toaster/toast는 synapse 0.10.0+에서 export. 현재 0.9.3에서는 미제공.</p>
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION F: LAYOUT & UTILITY (45-53)        */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">F. Layout & Utility Components</h2>

                <Section title="45. EmptyState">
                    <div className="w-96 border border-border-100 rounded-large p-4">
                        <EmptyState icon={<FileText />} title="데이터 없음" description="조건을 조정하세요." />
                    </div>
                </Section>

                <Section title="46. WidgetGrid">
                    <div className="w-full">
                        <WidgetGrid columns={3} gap="md">
                            <WidgetGridItem><Card><CardContent className="p-4"><p className="text-body-2">Grid 1</p></CardContent></Card></WidgetGridItem>
                            <WidgetGridItem><Card><CardContent className="p-4"><p className="text-body-2">Grid 2</p></CardContent></Card></WidgetGridItem>
                            <WidgetGridItem><Card><CardContent className="p-4"><p className="text-body-2">Grid 3</p></CardContent></Card></WidgetGridItem>
                        </WidgetGrid>
                    </div>
                </Section>

                <Section title="47. CollapsibleSection">
                    <div className="w-96">
                        <CollapsibleSection title="접이식 섹션" defaultOpen>
                            <p className="text-body-2 text-text-secondary p-4">Content here</p>
                        </CollapsibleSection>
                    </div>
                </Section>

                <Section title="48. LoadingOverlay">
                    <div className="w-64 h-24 relative border border-border-100 rounded-large">
                        <LoadingOverlay loading={loadingDemo} text="로딩 중...">
                            <div className="p-4"><p className="text-body-2">Content behind overlay</p></div>
                        </LoadingOverlay>
                    </div>
                    <Button buttonStyle="secondary" size="sm" onClick={() => { setLoadingDemo(true); setTimeout(() => setLoadingDemo(false), 2000); }}>Toggle Loading</Button>
                </Section>

                <Section title="49. ApiActionButton">
                    <ApiActionButton
                        onAction={() => new Promise(r => setTimeout(r, 1500))}
                        label="실행"
                        loadingLabel="처리 중..."
                        successLabel="완료!"
                    />
                </Section>

                <Section title="50. ResizablePanel">
                    <div className="w-full h-32 border border-border-100 rounded-large overflow-hidden">
                        <ResizablePanelGroup direction="horizontal">
                            <ResizablePanel defaultSize={50}><div className="p-4 bg-background-50 h-full"><p className="text-body-2">Left</p></div></ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel defaultSize={50}><div className="p-4 h-full"><p className="text-body-2">Right</p></div></ResizablePanel>
                        </ResizablePanelGroup>
                    </div>
                </Section>

                <Section title="51. SortableList">
                    <div className="w-64">
                        <SortableList
                            items={sortableItems}
                            onReorder={(items) => console.log("reordered", items)}
                            renderItem={(item) => (
                                <div className="flex items-center gap-2 p-2 border border-border-100 rounded-medium bg-background-100">
                                    <GripVertical className="size-4 text-icon-tertiary" />
                                    <span className="text-body-2">{item.label}</span>
                                </div>
                            )}
                        />
                    </div>
                </Section>

                <Section title="52. DynamicTabs">
                    <div className="w-96">
                        <DynamicTabs
                            tabs={dynamicTabs}
                            activeTabId={activeTabId}
                            onTabChange={setActiveTabId}
                            addable
                            onTabAdd={() => {
                                const id = `tab${dynamicTabs.length + 1}`;
                                setDynamicTabs([...dynamicTabs, { id, label: `탭 ${dynamicTabs.length + 1}`, closable: true }]);
                                setActiveTabId(id);
                            }}
                            onTabRemove={(id) => {
                                setDynamicTabs(dynamicTabs.filter(t => t.id !== id));
                                if (activeTabId === id) setActiveTabId(dynamicTabs[0]?.id ?? "");
                            }}
                        />
                    </div>
                </Section>

                <Section title="53. ConditionalRenderer">
                    <ConditionalRenderer
                        value={75}
                        rules={[
                            { condition: (v: number) => v >= 80, render: (v: number) => <Badge theme="green" badgeStyle="filled" size="md">우수 ({v})</Badge> },
                            { condition: (v: number) => v >= 50, render: (v: number) => <Badge theme="yellow" badgeStyle="filled" size="md">보통 ({v})</Badge> },
                            { condition: () => true, render: (v: number) => <Badge theme="red" badgeStyle="filled" size="md">미달 ({v})</Badge> },
                        ]}
                    />
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION G: ADVANCED UI (54-58)             */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">G. Advanced UI</h2>

                <Section title="54. ThemeSwitcher">
                    <ThemeSwitcher options={themeOptions} value={themeVal} onValueChange={setThemeVal} />
                    <StateDisplay label="theme" value={themeVal} />
                </Section>

                <Section title="55. HierarchicalFilter">
                    <div className="w-64">
                        <HierarchicalFilter data={treeData} value={treeFilterVal} onValueChange={setTreeFilterVal} showCount />
                    </div>
                    <StateDisplay label="filter" value={treeFilterVal.join(",")} />
                </Section>

                <Section title="56. FilterPreset">
                    <FilterPreset presets={filterPresets} activePresetId={activePreset} onPresetSelect={(p) => setActivePreset(p.id)} />
                    <StateDisplay label="preset" value={activePreset ?? "none"} />
                </Section>

                <Section title="57. WhatIfPanel">
                    <div className="w-full max-w-lg">
                        <WhatIfPanel
                            parameters={whatIfParams}
                            onParameterChange={(id, val) => console.log(id, val)}
                            title="시나리오 분석"
                            description="파라미터를 조정하세요"
                        />
                    </div>
                </Section>

                <Separator className="my-8" />

                {/* ═══════════════════════════════════════════ */}
                {/* SECTION H: CHARTS (58-70)                  */}
                {/* ═══════════════════════════════════════════ */}
                <h2 className="text-h2 mb-4 text-text-primary border-b border-border-200 pb-2">H. Synapse Charts</h2>

                <Section title="58. KpiCard">
                    <KpiCard title="총 매출" value="₩12,400,000" change="+8.2%" changeType="increase" sparklineData={sparklineData} unit="원" />
                    <KpiCard title="이탈률" value="3.2%" change="-1.5%" changeType="decrease" leadIcon={<TrendingUp className="text-icon-brand" />} />
                </Section>

                <Section title="59. BarChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>월별 매출</CardTitle></CardHeader><CardContent>
                            <BarChart data={barChartData} xField="month" yField="revenue" direction="vertical" colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="60. LineChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>일별 추이</CardTitle></CardHeader><CardContent>
                            <LineChart data={lineChartData} xField="date" yField="count" smooth colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="61. PieChart">
                    <div className="w-full max-w-sm">
                        <Card><CardHeader><CardTitle>감정 분포</CardTitle></CardHeader><CardContent>
                            <PieChart data={pieChartData} nameField="name" valueField="value" donut innerRadius={60} colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="62. AreaChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>트렌드</CardTitle></CardHeader><CardContent>
                            <AreaChart data={areaChartData} xField="date" yField="value" gradient colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="63. ScatterChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>산점도</CardTitle></CardHeader><CardContent>
                            <ScatterChart data={scatterData} xField="x" yField="y" sizeField="size" colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="64. HeatmapChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>히트맵</CardTitle></CardHeader><CardContent>
                            <HeatmapChart data={heatmapData} xCategories={["Mon", "Tue", "Wed"]} yCategories={["Morning", "Afternoon"]} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="65. TreemapChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>트리맵</CardTitle></CardHeader><CardContent>
                            <TreemapChart data={treemapData} colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="66. GaugeChart">
                    <div className="w-full max-w-sm">
                        <Card><CardHeader><CardTitle>게이지</CardTitle></CardHeader><CardContent>
                            <GaugeChart value={72} min={0} max={100} label="달성률" height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="67. WaterfallChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>워터폴</CardTitle></CardHeader><CardContent>
                            <WaterfallChart data={waterfallData} categoryField="category" valueField="value" typeField="type" colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="68. FunnelChart">
                    <div className="w-full max-w-lg">
                        <Card><CardHeader><CardTitle>퍼널</CardTitle></CardHeader><CardContent>
                            <FunnelChart data={funnelData} nameField="stage" valueField="count" showConversionRate colors={CHART_COLORS} height={280} />
                        </CardContent></Card>
                    </div>
                </Section>

                <Section title="69. SparklineChart">
                    <div className="flex gap-4 items-center">
                        <div className="w-32 h-8"><SparklineChart data={sparklineData} type="line" /></div>
                        <div className="w-32 h-8"><SparklineChart data={sparklineData} type="bar" /></div>
                    </div>
                </Section>

                <Section title="70. ChartContainer (loading/empty states)">
                    <div className="flex gap-4">
                        <div className="w-64"><ChartContainer height={150} loading><div /></ChartContainer></div>
                        <div className="w-64"><ChartContainer height={150} empty emptyText="데이터가 없습니다"><div /></ChartContainer></div>
                    </div>
                </Section>

                <Separator className="my-8" />
                <p className="text-body-2 text-text-tertiary pb-8">
                    End of verification (70 sections). Check console for errors.
                </p>
            </div>
        </TooltipProvider>
    );
}
