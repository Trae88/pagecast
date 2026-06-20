import { Clock, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useSetDefaultExpiry } from "@/hooks/use-pagecast";
import { EXPIRY_PRESETS } from "@/lib/format";

interface DefaultExpiryCardProps {
  defaultExpiry: string | undefined;
}

export function DefaultExpiryCard({ defaultExpiry }: DefaultExpiryCardProps) {
  const setDefaultExpiry = useSetDefaultExpiry();
  const current = defaultExpiry ?? "30d";
  // A non-preset duration (e.g. "3d" set via CLI) still needs a visible option,
  // so the trigger reflects the real saved value instead of rendering empty.
  const options = EXPIRY_PRESETS.some((preset) => preset.value === current)
    ? EXPIRY_PRESETS
    : [{ value: current, label: current }, ...EXPIRY_PRESETS];

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Default link expiry
        </CardTitle>
        <CardDescription>
          New published links expire after this by default. Set "Never" for
          permanent links, or override the expiry on any individual link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={current}
          disabled={setDefaultExpiry.isPending}
          onValueChange={(value) => setDefaultExpiry.mutate(value)}
        >
          <SelectTrigger className="w-full" aria-label="Default link expiry">
            {setDefaultExpiry.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating…
              </span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            {options.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
