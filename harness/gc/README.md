# Garbage Collection Harness

이 디렉토리는 코드베이스 오염을 탐지하는 최소 garbage collection harness를 담는다.

## Scope

현재 `v0`는 아래를 검사한다.

1. import graph 기준 미참조 `components/` 파일
2. import graph 기준 미참조 `lib/` 파일
3. 금지된 임시 패턴 (`console.log`, `TODO`, `FIXME`, `HACK`)

## Run

```bash
python3 harness/gc/run.py
```
