/**
 * ui — the design system (shadcn-based, mobile-first, WCAG 2.1 AA).
 *
 *   primitives/ — buttons, inputs (shadcn components we OWN)
 *   patterns/   — booking wizard, cards, lists
 *   shell/      — adaptive nav: bottom-bar on mobile <-> sidebar on desktop
 *
 * All color/spacing/typography/radius come from design tokens, so per-clinic
 * branding = swap token values, never touch components.
 *
 * See docs/04-ui-ux-system.md.
 */

export { Button, buttonVariants } from "./primitives/button";
export { Input } from "./primitives/input";
export { Label } from "./primitives/label";
export { Textarea } from "./primitives/textarea";
export { Checkbox } from "./primitives/checkbox";
export { RadioGroup, RadioGroupItem } from "./primitives/radio-group";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./primitives/select";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./primitives/card";
export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  useFormField,
} from "./primitives/form";
export { ClinicThemeProvider } from "./theme/clinic-theme";
export { brandingToStyle } from "./theme/branding";
export { AccessibilityToolbar } from "./shell/accessibility-toolbar";
