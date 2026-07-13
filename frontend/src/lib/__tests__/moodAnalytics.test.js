import {
  MOOD_WORD_TO_NUM, unifyMoodEntries, moodDailySeries, moodTrend,
  dimensionSeries, moodUsageCorrelation,
} from "../moodAnalytics";
import { localDateStr, addDaysStr } from "../dates";

const NOW = new Date(2026, 6, 12, 12, 0, 0);
const NOW_STR = localDateStr(NOW);

function tsDaysAgo(age, hour = 10) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - age);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe("unifyMoodEntries", () => {
  test("maps legacy word moods and numeric check-ins into one list", () => {
    const checkins = [{ mood: 4, timestamp: tsDaysAgo(1) }];
    const logs = [
      { mood: "great", timestamp: tsDaysAgo(2) },
      { mood: "bad", timestamp: tsDaysAgo(3) },
      { mood: null, timestamp: tsDaysAgo(4) }, // ignored
    ];
    const entries = unifyMoodEntries(checkins, logs);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.mood).sort()).toEqual([1, 4, 5]);
    expect(entries.find((e) => e.source === "checkin").mood).toBe(4);
  });

  test("word mapping covers the full scale", () => {
    expect(MOOD_WORD_TO_NUM).toEqual({ great: 5, good: 4, okay: 3, low: 2, bad: 1 });
  });
});

describe("moodDailySeries", () => {
  test("averages multiple entries per day, nulls for gaps", () => {
    const entries = unifyMoodEntries(
      [{ mood: 5, timestamp: tsDaysAgo(1, 9) }, { mood: 3, timestamp: tsDaysAgo(1, 20) }],
      [{ mood: "bad", timestamp: tsDaysAgo(3) }]
    );
    const series = moodDailySeries(entries, { days: 7, now: NOW });
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].date).toBe(NOW_STR);
    const yesterday = series.find((p) => p.date === addDaysStr(NOW_STR, -1));
    expect(yesterday.mood).toBe(4); // avg(5, 3)
    const threeAgo = series.find((p) => p.date === addDaysStr(NOW_STR, -3));
    expect(threeAgo.mood).toBe(1);
    const twoAgo = series.find((p) => p.date === addDaysStr(NOW_STR, -2));
    expect(twoAgo.mood).toBeNull();
  });
});

describe("moodTrend", () => {
  const mkSeries = (values) => values.map((v, i) => ({ date: addDaysStr(NOW_STR, -(values.length - 1 - i)), mood: v }));

  test("empty → stable with null avg", () => {
    expect(moodTrend(mkSeries([null, null, null]))).toEqual({ avg: null, slope: 0, direction: "stable", n: 0 });
  });

  test("rising moods → improving", () => {
    const t = moodTrend(mkSeries([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]));
    expect(t.direction).toBe("improving");
    expect(t.slope).toBeGreaterThan(0);
  });

  test("falling moods → declining", () => {
    const t = moodTrend(mkSeries([5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1]));
    expect(t.direction).toBe("declining");
  });

  test("flat moods → stable", () => {
    const t = moodTrend(mkSeries([3, 3, null, 3, 3, 3, null, 3]));
    expect(t.direction).toBe("stable");
    expect(t.avg).toBe(3);
  });
});

describe("dimensionSeries", () => {
  test("extracts one dimension, skipping nulls", () => {
    const checkins = [
      { mood: 3, sleep: 2, timestamp: tsDaysAgo(1) },
      { mood: 3, sleep: null, timestamp: tsDaysAgo(2) },
    ];
    const series = dimensionSeries(checkins, "sleep", { days: 7, now: NOW });
    expect(series.find((p) => p.date === addDaysStr(NOW_STR, -1)).mood).toBe(2);
    expect(series.find((p) => p.date === addDaysStr(NOW_STR, -2)).mood).toBeNull();
  });
});

describe("moodUsageCorrelation", () => {
  test("low mood coinciding with high usage → negative score", () => {
    const series = [];
    const usage = new Map();
    for (let i = 13; i >= 0; i--) {
      const date = addDaysStr(NOW_STR, -i);
      const low = i % 2 === 0;
      series.push({ date, mood: low ? 1 : 5 });
      usage.set(date, low ? 4 : 0);
    }
    const { score, n } = moodUsageCorrelation(series, usage);
    expect(n).toBe(14);
    expect(score).toBeLessThan(-0.5);
  });

  test("insufficient data → 0", () => {
    expect(moodUsageCorrelation([{ date: NOW_STR, mood: 3 }], new Map()).score).toBe(0);
  });
});
