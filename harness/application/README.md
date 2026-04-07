# Application Harness

이 디렉토리는 앱 수준의 계약을 검사하는 harness를 담는다.

## Scope

현재 `v0`는 실제 모델 호출 없이 agent 응답 계약만 검사한다.

대상:

1. `onboarding-agent` 응답 구조
2. `daily-agent` 응답 구조
3. `improvements` 길이 3 보장
4. 금지 필드 혼입 방지

## Run

```bash
python3 harness/application/run.py
```

## Notes

- 현재 저장소에는 앱 코드가 없으므로 fixture 기반으로 계약을 고정한다.
- 이후 앱 코드가 생기면 실제 함수 출력이나 API 응답을 같은 validator로 검사하도록 확장한다.
