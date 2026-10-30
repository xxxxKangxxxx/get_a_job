// 내 데이터 파일 위치. data/ 폴더는 git에 올라가지 않는다 (사람마다 다르다).
import { resolve } from "node:path";

/** 공고·지원현황 원본 JSON. 환경변수 POSTINGS_JSON으로 바꿀 수 있다. */
export const postingsJsonPath = () => resolve(process.env.POSTINGS_JSON || "data/postings.json");

/** 내 조건(희망 직무·지역·적합도 기준). 공고 수집 스킬이 읽는다. */
export const profilePath = () => resolve(process.env.PROFILE_MD || "data/profile.md");
