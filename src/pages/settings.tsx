import Metadata from '@/components/Metadata';
import {
  useSettings,
  type ThemeSetting,
  type MotionSetting,
} from '@/lib/settings';

// A labelled segmented radio group. Generic over the option value so both the
// theme and motion controls can share it.
function OptionGroup<T extends string>({
  legend,
  hint,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="mb-8">
      <legend className="text-lg font-medium">{legend}</legend>
      <p className="mb-3 text-sm opacity-70">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-md border-2 px-4 py-2 text-sm transition-colors ${
                selected
                  ? 'border-highlight bg-highlight text-secondary'
                  : 'border-secondary hover:bg-secondary hover:text-white'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const motionOptions: { value: MotionSetting; label: string }[] = [
  { value: 'system', label: 'Automatic' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

export default function SettingsPage() {
  const { settings, setTheme, setMotion } = useSettings();

  return (
    <>
      <Metadata title="Settings" description="Appearance and accessibility preferences" />

      <section>
        <h3 className="mb-6 text-2xl font-semibold">Settings</h3>

        <OptionGroup
          legend="Appearance"
          hint="Automatic follows your device's light/dark setting. Choose Light or Dark to override it."
          name="theme"
          value={settings.theme}
          options={themeOptions}
          onChange={setTheme}
        />

        <OptionGroup
          legend="Animations"
          hint="Automatic follows your device's reduce-motion setting. Reduced disables transitions and animations."
          name="motion"
          value={settings.motion}
          options={motionOptions}
          onChange={setMotion}
        />

        <p className="text-sm opacity-70">
          These preferences are saved in this browser only.
        </p>
      </section>
    </>
  );
}
