# 프로필 이미지 생성 기록

내장 `image_gen` 도구로 생성한 동물 프로필 20개입니다. 앱에서 사용하는 파일은 `public/avatars/{id}.webp`이며, 원본에서 256×256 WebP(품질 88)로 변환했습니다.

## 공통 프롬프트

첫 5개(fox, cat, bear, rabbit, panda)는 아래 문장에서 `simple dark eyes` 대신 `simple eyes`를 사용했습니다.

```text
Use case: stylized-concept. Asset type: square profile avatar for a Korean web app. Subject: {subject}. One original friendly animal character, centered head and shoulders filling 75% of square, straight-on view, expressive simple dark eyes, subtle smile. Premium playful soft clay 3D illustration, rounded sculpted shapes, matte texture, soft studio lighting, clean solid colored background. Cohesive collectible avatar series, readable at 32px. Full bleed square, no border, no lettering, no logo, no watermark, no accessories.
```

## 개별 subject

| id | subject |
| --- | --- |
| fox | burnt orange fox, teal background |
| cat | lavender cat, purple background |
| bear | honey brown bear, butter yellow background |
| rabbit | cream rabbit, coral background |
| panda | black and white panda, mint background |
| dog | golden puppy with floppy ears, sky blue background |
| koala | gray koala with round fluffy ears, peach background |
| tiger | orange tiger with rounded ears and dark stripes, pale teal background |
| penguin | black and white penguin with a small orange beak, lavender background |
| owl | brown owl with big gentle eyes and small ear tufts, pale yellow background |
| otter | brown otter with a cream muzzle and tiny whiskers, aqua background |
| frog | green frog with round eyes, pale peach background |
| lion | golden lion with a rounded warm brown mane, sky blue background |
| raccoon | gray raccoon with a dark eye mask, pale coral background |
| red-panda | rust red panda with white cheeks and pointed ears, pale mint background |
| seal | plump light gray seal with dark eyes and whiskers, periwinkle background |
| hamster | golden hamster with round cheeks and tiny ears, pastel pink background |
| deer | fawn deer with small antlers and white spots, sage background |
| capybara | brown capybara with broad rounded muzzle and small ears, pale yellow background |
| wolf | friendly gray wolf with pointed ears and cream cheeks, dusty blue background |
