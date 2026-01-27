# Design Document: Radio Component

## Overview

The Radio component is a form input component that allows users to select a single option from a set of choices. It follows the design system's established patterns using CVA for variant management and implements a compound component architecture. The component provides two size variants (sm: 16x16px, md: 20x20px) and supports multiple visual states (default, hover, focused, disabled) for both checked and unchecked conditions.

The implementation will leverage Radix UI's Radio primitive for accessibility and behavior, similar to how the Checkbox component uses Radix UI primitives. This ensures proper keyboard navigation, ARIA attributes, and screen reader support out of the box.

## Architecture

### Component Structure

```
Radio (Root Component)
├── RadioGroup (Compound Component for grouping)
└── RadioGroupItem (Individual radio button)
```

The Radio component follows the compound component pattern where:
- **RadioGroup**: Manages the state and coordination of multiple radio buttons
- **RadioGroupItem**: Individual radio button that can be checked/unchecked

### Technology Stack

- **React**: Component framework
- **TypeScript**: Type safety and developer experience
- **CVA (class-variance-authority)**: Variant system management
- **Radix UI Radio**: Accessible radio primitive
- **Tailwind CSS**: Styling system
- **Vite**: Build tool for ESM/CJS output

## Components and Interfaces

### RadioGroup Component

The RadioGroup component wraps multiple RadioGroupItem components and manages their collective state.

**Props Interface:**
```typescript
interface RadioGroupProps extends React.ComponentPropsWithoutRef<typeof RadioPrimitive.Root> {
  className?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}
```

**Behavior:**
- Manages which radio button is currently selected
- Ensures only one radio button in the group can be selected at a time
- Provides keyboard navigation between radio buttons (arrow keys)
- Forwards all standard RadioGroup props to Radix UI primitive

### RadioGroupItem Component

The RadioGroupItem component represents an individual radio button.

**Props Interface:**
```typescript
interface RadioGroupItemProps 
  extends React.ComponentPropsWithoutRef<typeof RadioPrimitive.Item>,
    VariantProps<typeof radioVariants> {
  size?: "sm" | "md";
  className?: string;
  value: string;
  disabled?: boolean;
}
```

**Behavior:**
- Renders a circular radio button with appropriate size
- Shows a filled circle indicator when checked
- Responds to hover, focus, and disabled states
- Forwards ref for external control

### CVA Variant Configuration

```typescript
const radioVariants = cva(
  "inline-flex items-center justify-center shrink-0 rounded-full border transition-all cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-16 w-16",
        md: "h-20 w-20",
      },
      checked: {
        unchecked: "",
        checked: "",
      },
    },
    compoundVariants: [
      // Unchecked state
      {
        checked: "unchecked",
        className:
          "border-border-200 bg-background-0 hover:border-border-200-hover focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-disabled:cursor-not-allowed data-disabled:border-border-100 data-disabled:bg-background-100",
      },
      // Checked state
      {
        checked: "checked",
        className:
          "border-border-200 bg-background-0 hover:border-border-200-hover focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-disabled:cursor-not-allowed data-disabled:border-border-100 data-disabled:bg-background-100",
      },
    ],
    defaultVariants: {
      size: "sm",
      checked: "unchecked",
    },
  }
);
```

### Indicator Styling

The checked indicator (filled circle) will be styled separately:

```typescript
const radioIndicatorVariants = cva(
  "flex items-center justify-center rounded-full transition-all",
  {
    variants: {
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
      },
    },
    compoundVariants: [
      {
        size: "sm",
        className: "bg-background-inverted data-disabled:bg-gray-400",
      },
      {
        size: "md",
        className: "bg-background-inverted data-disabled:bg-gray-400",
      },
    ],
    defaultVariants: {
      size: "sm",
    },
  }
);
```

## Data Models

### Radio State Model

```typescript
type RadioValue = string;

interface RadioState {
  value: RadioValue;        // Currently selected radio value
  disabled: boolean;        // Whether the group is disabled
  name?: string;           // Form field name
}
```

### Size Configuration

```typescript
type RadioSize = "sm" | "md";

const SIZE_CONFIG = {
  sm: {
    container: "16px",      // h-16 w-16
    indicator: "8px",       // h-8 w-8
  },
  md: {
    container: "20px",      // h-20 w-20
    indicator: "10px",      // h-10 w-10
  },
} as const;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I've identified the following consolidations:

**Redundancies to eliminate:**
- Properties 1.1 and 1.2 can be combined into a single property about size-to-dimension mapping
- Properties 2.5 and 2.6 can be combined into a single property about focus behavior
- Properties 2.7 and 2.8 can be combined into a single property about disabled state
- Property 4.2 is redundant with the combined 2.7/2.8 property
- Property 10.5 is redundant with the combined 2.7/2.8 property

**Properties to keep as separate:**
- Size variant mapping (combines 1.1, 1.2)
- Checked state indicator presence (2.2)
- Focus ring behavior (combines 2.5, 2.6)
- Disabled state behavior (combines 2.7, 2.8, 4.2, 10.5)
- Custom className application (3.4)
- Checked prop control (4.1)
- onChange callback firing (4.3)
- Standard prop forwarding (4.4, 4.5, 4.6)
- Keyboard focusability (10.1)
- Space key interaction (10.2)
- Arrow key navigation (10.3)
- ARIA attributes (10.4)

### Correctness Properties

Property 1: Size variant dimensions
*For any* Radio component with a size prop, the rendered dimensions should match the size configuration (sm: 16x16px, md: 20x20px)
**Validates: Requirements 1.1, 1.2**

Property 2: Checked indicator presence
*For any* Radio component that is checked, the component should render a filled circle indicator element
**Validates: Requirements 2.2**

Property 3: Focus ring visibility
*For any* Radio component that receives focus, the component should display a visible focus ring regardless of checked state
**Validates: Requirements 2.5, 2.6**

Property 4: Disabled state prevents interaction
*For any* Radio component with disabled prop set to true, the component should not respond to click or keyboard events and should apply disabled styling
**Validates: Requirements 2.7, 2.8, 4.2, 10.5**

Property 5: Custom className application
*For any* Radio component with a className prop, the provided className should be present in the rendered element's class list
**Validates: Requirements 3.4**

Property 6: Checked prop controls state
*For any* Radio component with a checked prop, the component's selected state should match the prop value
**Validates: Requirements 4.1**

Property 7: onChange callback invocation
*For any* Radio component with an onChange callback, the callback should be invoked when the radio's selection state changes through user interaction
**Validates: Requirements 4.3**

Property 8: Standard props forwarding
*For any* Radio component with standard HTML input attributes (name, value, id, etc.), those attributes should be present on the underlying input element
**Validates: Requirements 4.4, 4.5, 4.6**

Property 9: Keyboard focusability
*For any* non-disabled Radio component, the component should be focusable via keyboard Tab navigation
**Validates: Requirements 10.1**

Property 10: Space key selection
*For any* focused Radio component, pressing the Space key should select that radio button
**Validates: Requirements 10.2**

Property 11: Arrow key navigation
*For any* RadioGroup with multiple radio buttons, pressing arrow keys should move focus between the radio buttons in the group
**Validates: Requirements 10.3**

Property 12: ARIA attributes presence
*For any* Radio component, the component should include appropriate ARIA attributes (role, aria-checked, aria-disabled) for screen reader support
**Validates: Requirements 10.4**

## Error Handling

### Invalid Props

**Size Prop Validation:**
- If an invalid size value is provided, the component will fall back to the default "sm" size
- TypeScript types will prevent invalid values at compile time

**Value Prop in RadioGroup:**
- If a RadioGroup's value prop doesn't match any RadioGroupItem value, no radio will be selected
- This is valid behavior and not an error

**Missing Value Prop:**
- Each RadioGroupItem must have a value prop
- TypeScript will enforce this requirement at compile time

### Accessibility Errors

**Missing RadioGroup:**
- RadioGroupItem components should be used within a RadioGroup for proper behavior
- Using RadioGroupItem outside a RadioGroup will result in undefined behavior
- Documentation will clearly state this requirement

**Duplicate Values:**
- Multiple RadioGroupItem components with the same value in a group will cause selection issues
- This is a developer error that should be caught during development

### State Management Errors

**Controlled vs Uncontrolled:**
- RadioGroup supports both controlled (value + onValueChange) and uncontrolled (defaultValue) modes
- Mixing both patterns (providing both value and defaultValue) will prioritize controlled mode
- React will warn about switching between controlled and uncontrolled modes

## Testing Strategy

### Dual Testing Approach

The Radio component will use both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** will focus on:
- Specific examples of size rendering (one test for sm, one for md)
- Edge cases like missing props or default values
- Integration between RadioGroup and RadioGroupItem
- Specific keyboard interactions (Tab, Space, Arrow keys)
- ARIA attribute presence for specific scenarios

**Property-Based Tests** will focus on:
- Universal properties that hold for all inputs
- Size-to-dimension mapping across all size variants
- Checked state behavior across all possible states
- Disabled state behavior across all interaction attempts
- Custom className application for any valid className string
- Prop forwarding for any valid HTML attribute

### Property-Based Testing Configuration

**Library:** We will use `@fast-check/vitest` for property-based testing in the Vitest test environment.

**Configuration:**
- Minimum 100 iterations per property test
- Each property test will reference its design document property
- Tag format: `// Feature: radio-component, Property {number}: {property_text}`

**Example Property Test Structure:**
```typescript
import { test } from 'vitest';
import { fc, testProp } from '@fast-check/vitest';

// Feature: radio-component, Property 1: Size variant dimensions
testProp('radio dimensions match size configuration', 
  [fc.constantFrom('sm', 'md')],
  (size) => {
    const { container } = render(<RadioGroupItem value="test" size={size} />);
    const radio = container.querySelector('[role="radio"]');
    const expectedSize = size === 'sm' ? '16px' : '20px';
    expect(radio).toHaveStyle({ width: expectedSize, height: expectedSize });
  },
  { numRuns: 100 }
);
```

### Test Coverage Goals

- **Unit Test Coverage:** Minimum 90% code coverage
- **Property Test Coverage:** All 12 correctness properties must have corresponding property tests
- **Integration Tests:** RadioGroup + RadioGroupItem interaction patterns
- **Accessibility Tests:** Keyboard navigation and ARIA attributes

### Testing Tools

- **Vitest:** Test runner
- **@testing-library/react:** Component testing utilities
- **@testing-library/user-event:** User interaction simulation
- **@fast-check/vitest:** Property-based testing
- **@axe-core/react:** Accessibility testing

## Implementation Notes

### Radix UI Integration

The component will use `@radix-ui/react-radio-group` as the foundation, similar to how Checkbox uses `@radix-ui/react-checkbox`. This provides:
- Proper keyboard navigation out of the box
- ARIA attributes automatically applied
- Focus management
- Form integration

### Styling Approach

Following the existing pattern from Checkbox:
- Use CVA for variant management
- Use Tailwind CSS utility classes
- Use `cn()` utility for className merging
- Use `data-disabled` attribute for disabled styling (not `:disabled` pseudo-class)

### Korean JSDoc Template

```typescript
/**
 * Radio 컴포넌트 Props
 *
 * @property {"sm" | "md"} size - 라디오 버튼 크기
 *   - `"sm"`: 16px (기본값)
 *   - `"md"`: 20px
 *
 * @property {string} value - 라디오 버튼의 값 (필수)
 *
 * @property {boolean} disabled - 비활성화 여부
 *
 * @example
 * ```tsx
 * // 기본 라디오 그룹
 * const [value, setValue] = useState("option1");
 * <RadioGroup value={value} onValueChange={setValue}>
 *   <RadioGroupItem value="option1" />
 *   <RadioGroupItem value="option2" />
 * </RadioGroup>
 *
 * // 크기 변형
 * <RadioGroup defaultValue="option1">
 *   <RadioGroupItem value="option1" size="md" />
 *   <RadioGroupItem value="option2" size="md" />
 * </RadioGroup>
 *
 * // 비활성화된 라디오
 * <RadioGroupItem value="option1" disabled />
 * ```
 */
```

### Build Configuration

The component will be built using Vite with the following configuration:
- **Output formats:** ESM and CJS
- **Entry point:** `src/components/ui/radio.tsx`
- **Type definitions:** Generated via `tsc`
- **Tree-shaking:** Enabled via ESM format and proper exports

**package.json exports:**
```json
{
  "exports": {
    ".": {
      "import": "./dist/radio.js",
      "require": "./dist/radio.cjs",
      "types": "./dist/radio.d.ts"
    }
  }
}
```
