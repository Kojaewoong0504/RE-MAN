# Repository Harness

이 디렉토리는 저장소 수준의 계약을 검사하는 최소 harness를 담는다.

## Scope

현재 `v0`는 아래만 검사한다.

1. 필수 문서 존재
2. `AGENTS.md`의 에이전트 정의 존재
3. `AGENTS.md`와 `docs/engineering/architecture.md`의 모델 계약 존재
4. `docs/engineering/security.md`와 `docs/engineering/reliability.md`의 보호/대응 규칙 존재

## Run

```bash
python3 harness/repository/run.py
```

## Why Python

현재 작업 환경에는 `python3`가 있고 `node`/`npm`는 없다.
따라서 repository harness의 첫 실행 경로는 Python 표준 라이브러리만 사용한다.
