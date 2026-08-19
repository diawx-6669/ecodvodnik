/*
  ЭкоДвойник — упрощённая демо-прошивка на ПОТЕНЦИОМЕТРАХ
  Плата: Arduino Uno

  Зачем: реальные датчики воды (геркон) и электричества (SCT-013) есть не
  у всех, а потенциометр — самая простая и универсальная деталь, которая
  есть почти в любом стартовом наборе Arduino. Здесь два потенциометра
  эмулируют "расход воды" и "расход электричества" — крутите ручку, и
  значение меняется, как будто льётся вода / потребляется энергия.

  Подключение (для КАЖДОГО потенциометра):
  - Крайний левый вывод  -> 5V
  - Крайний правый вывод -> GND
  - Средний вывод (движок) -> аналоговый пин (см. ниже)

  Если у вас только ОДИН потенциометр — оставьте только WATER_PIN,
  закомментируйте блок с электричеством ниже (или используйте один и тот
  же потенциометр по очереди для обоих типов, вручную меняя код).

  Формат вывода в Serial — такой же JSON, как у "боевых" прошивок, поэтому
  scripts/serial_bridge.py и backend НЕ нужно менять вообще.
*/

const int WATER_PIN = A0;        // потенциометр №1 — эмулирует счётчик воды
const int ELECTRICITY_PIN = A1;  // потенциометр №2 — эмулирует счётчик электричества

// Насколько сильно значение потенциометра (0-1023) превращается в литры/кВт·ч
// за один цикл отправки. Подберите под себя — просто для наглядности демо.
const float MAX_LITERS_PER_TICK = 8.0;         // при полностью выкрученной ручке
const float MAX_KWH_PER_TICK = 0.5;            // при полностью выкрученной ручке

const unsigned long SEND_INTERVAL_MS = 10000;  // печатать в Serial раз в 10 секунд

unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(9600);
  lastSendTime = millis();
  Serial.println("{\"status\":\"ready\",\"sensor\":\"potentiometer_demo\"}");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    // --- Вода (потенциометр №1) ---
    int waterRaw = analogRead(WATER_PIN);                 // 0..1023
    float liters = (waterRaw / 1023.0) * MAX_LITERS_PER_TICK;

    if (liters > 0.01) {
      Serial.print("{\"type\":\"water\",\"value\":");
      Serial.print(liters);
      Serial.println("}");
    }

    // --- Электричество (потенциометр №2) ---
    // Если у вас только один потенциометр — просто закомментируйте
    // этот блок целиком (Ctrl+K+C в Arduino IDE) и не подключайте A1.
    int elecRaw = analogRead(ELECTRICITY_PIN);             // 0..1023
    float kwh = (elecRaw / 1023.0) * MAX_KWH_PER_TICK;

    if (kwh > 0.001) {
      Serial.print("{\"type\":\"electricity\",\"value\":");
      Serial.print(kwh);
      Serial.println("}");
    }

    lastSendTime = now;
  }
}
