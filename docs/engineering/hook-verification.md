# hook-verification.md

## Purpose

이 문서는 git hook이 실제로 차단 동작을 하는지 검증하는 방법을 정의한다.

## Principle

hook은 설정만 되어 있으면 충분하지 않다.
의도적으로 실패를 만들어 실제로 막는지 확인해야 한다.

## Current Check

현재 저장소는 아래 스크립트로 pre-commit 차단을 검증한다.

```bash
sh scripts/verify-hooks.sh
```

이 스크립트는 임시로 금지 표현을 fixture에 주입한 뒤 pre-commit을 실행한다.
hook이 제대로 동작하면 실패해야 하며, 그 실패는 정상이다.

이 검증은 fixture를 임시로 바꾸므로 다른 gate 실행과 동시에 돌리지 않는다.

## Expected Result

- `PASS hook-verification` 이 보여야 한다
- 내부적으로는 pre-commit이 실패해야 한다
- 스크립트 종료 후 fixture는 원래 상태로 복구되어야 한다
