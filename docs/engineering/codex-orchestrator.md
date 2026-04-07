# codex-orchestrator.md

## Purpose

이 문서는 Codex CLI 기반 self-repair orchestrator를 설명한다.

## Current Runner

현재 저장소는 아래 실행기로 Codex를 비대화식 재호출한다.

```bash
python3 scripts/codex_repair_runner.py pre-commit 1
```

의미:

- 첫 번째 인자: gate mode
- 두 번째 인자: retry budget

## Flow

1. gate 실패 발생
2. `parse_failures.py`가 실패를 정규화
3. `retry-agent.py`가 repair context 생성
4. `codex_repair_runner.py`가 Codex CLI를 재호출
5. Codex가 최소 수정 수행
6. orchestrator가 같은 gate를 다시 실행
7. 예산 소진 시 incident 기록

## Safety Rules

- 수정 범위는 reported failures에 한정한다
- 규칙 약화, 테스트 삭제, gate 우회는 금지한다
- 재시도는 무한 루프를 막기 위해 제한한다
