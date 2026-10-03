interface Hours {
  weekdays: readonly number[];
  time: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function openStatus(hours: readonly Hours[], timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const day = DAYS.indexOf(get("weekday"));
  const minutes = toMinutes(`${get("hour")}:${get("minute")}`);

  const today = hours.find((row) => row.weekdays.includes(day));
  const range = today?.time.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
  if (!range) return { open: false, label: "Cerrado hoy" };

  const [, start, end] = range;
  if (minutes < toMinutes(start)) return { open: false, label: `Abre a las ${start}` };
  if (minutes >= toMinutes(end)) return { open: false, label: "Cerrado por hoy" };
  return { open: true, label: `Abierto · cierra ${end}` };
}
