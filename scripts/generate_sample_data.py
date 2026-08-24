"""
Генерирует синтетический CSV с историей потребления воды и электричества
для демонстрации платформы без реальных счётчиков/датчиков.

Запуск:
    python3 generate_sample_data.py

Результат: ../data/sample_consumption.csv
"""

import csv
import random
from datetime import datetime, timedelta

OUTPUT_PATH = "../data/sample_consumption.csv"
DAYS = 30

def generate_rows():
    rows = []
    start_date = datetime.now() - timedelta(days=DAYS)

    base_water = 350       # литров/день на семью
    base_electricity = 9.5  # кВт*ч/день

    for day in range(DAYS):
        date = start_date + timedelta(days=day)

        # Добавляем случайные колебания + небольшой рост к концу
        # (чтобы демо показывало "тревожный" тренд для питомца/аномалий)
        trend_factor = 1 + (day / DAYS) * 0.15

        water = base_water * trend_factor * random.uniform(0.85, 1.15)
        electricity = base_electricity * trend_factor * random.uniform(0.85, 1.15)

        # Симулируем "утечку" в последние 5 дней для демонстрации аномалии
        if day >= DAYS - 5:
            water *= 1.4

        rows.append({
            "date": date.strftime("%Y-%m-%d"),
            "type": "water",
            "value": round(water, 1),
            "unit": "liters",
        })
        rows.append({
            "date": date.strftime("%Y-%m-%d"),
            "type": "electricity",
            "value": round(electricity, 2),
            "unit": "kwh",
        })

    return rows


def main():
    rows = generate_rows()
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "type", "value", "unit"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Сгенерировано {len(rows)} записей -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
