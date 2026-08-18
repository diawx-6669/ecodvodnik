"""
Serial-мост между Arduino Uno и backend ЭкоДвойника.

Arduino Uno не умеет ходить в интернет напрямую, поэтому она печатает
показания в Serial-порт в виде JSON-строк (например, {"type":"water","value":1.0}),
а этот скрипт на компьютере читает порт и пересылает каждое показание
на backend через POST /api/readings.

Установка зависимостей:
    pip install pyserial requests

Запуск:
    python3 serial_bridge.py --port COM3          # Windows
    python3 serial_bridge.py --port /dev/ttyUSB0  # Linux
    python3 serial_bridge.py --port /dev/tty.usbmodem14101  # macOS

Порт можно узнать в Arduino IDE: Инструменты -> Порт.
"""

import argparse
import json
import time

import requests
import serial

DEFAULT_SERVER_URL = "http://localhost:3000/api/readings"
DEFAULT_DEVICE_TOKEN = "change_me_please"  # должен совпадать с backend/.env
DEFAULT_BAUD_RATE = 9600


def send_to_backend(server_url, token, reading):
    payload = {
        "type": reading.get("type"),
        "value": reading.get("value"),
        "source": "arduino",
        "token": token,
    }
    try:
        response = requests.post(server_url, json=payload, timeout=5)
        print(f"-> Отправлено: {payload} | Ответ: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"!! Ошибка отправки на backend: {e}")


def main():
    parser = argparse.ArgumentParser(description="Serial-мост Arduino -> backend ЭкоДвойника")
    parser.add_argument("--port", required=True, help="COM-порт или /dev/ttyUSB0 и т.п.")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD_RATE, help="Скорость Serial (по умолчанию 9600)")
    parser.add_argument("--server", default=DEFAULT_SERVER_URL, help="URL backend API")
    parser.add_argument("--token", default=DEFAULT_DEVICE_TOKEN, help="Device token (см. backend/.env)")
    args = parser.parse_args()

    print(f"Подключаюсь к {args.port} на скорости {args.baud}...")
    ser = serial.Serial(args.port, args.baud, timeout=2)
    time.sleep(2)  # дать Arduino время перезагрузиться после открытия порта
    print("Подключено. Жду данные с Arduino... (Ctrl+C для выхода)")

    while True:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if not line:
                continue

            print(f"<- Получено с Arduino: {line}")

            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                print("   (не JSON, пропускаем)")
                continue

            # Служебные сообщения вроде {"status":"ready",...} игнорируем
            if "type" not in data or "value" not in data:
                continue

            send_to_backend(args.server, args.token, data)

        except KeyboardInterrupt:
            print("\nОстановлено пользователем.")
            break
        except Exception as e:
            print(f"!! Неожиданная ошибка: {e}")
            time.sleep(1)

    ser.close()


if __name__ == "__main__":
    main()
