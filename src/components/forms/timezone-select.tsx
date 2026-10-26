import { SelectField } from "@/components/ui/field";

export function TimezoneSelect({
  zones,
  defaultValue,
  errors,
  label = "Zona horaria",
  name = "timezone",
}: {
  zones: string[];
  defaultValue: string;
  errors?: string[];
  label?: string;
  name?: string;
}) {
  return (
    <SelectField label={label} name={name} defaultValue={defaultValue} errors={errors}>
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone.replaceAll("_", " ")}
        </option>
      ))}
    </SelectField>
  );
}
