// data/postings.json, data/profile.md가 없으면 templates/에서 만든다. 이미 있으면 건드리지 않는다.  사용법: pnpm init-data
import "./env";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { postingsJsonPath, profilePath } from "./paths";

for (const [target, template] of [[postingsJsonPath(), "templates/postings.empty.json"], [profilePath(), "templates/profile.example.md"]]) {
  if (existsSync(target)) { console.log(`있음: ${target}`); continue; }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(template, target);
  console.log(`만듦: ${target}`);
}
