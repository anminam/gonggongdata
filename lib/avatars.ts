export const AVATARS = [
  {
    "id": "fox",
    "label": "여우",
    "src": "/avatars/fox.webp"
  },
  {
    "id": "cat",
    "label": "고양이",
    "src": "/avatars/cat.webp"
  },
  {
    "id": "bear",
    "label": "곰",
    "src": "/avatars/bear.webp"
  },
  {
    "id": "rabbit",
    "label": "토끼",
    "src": "/avatars/rabbit.webp"
  },
  {
    "id": "panda",
    "label": "판다",
    "src": "/avatars/panda.webp"
  },
  {
    "id": "dog",
    "label": "강아지",
    "src": "/avatars/dog.webp"
  },
  {
    "id": "koala",
    "label": "코알라",
    "src": "/avatars/koala.webp"
  },
  {
    "id": "tiger",
    "label": "호랑이",
    "src": "/avatars/tiger.webp"
  },
  {
    "id": "penguin",
    "label": "펭귄",
    "src": "/avatars/penguin.webp"
  },
  {
    "id": "owl",
    "label": "부엉이",
    "src": "/avatars/owl.webp"
  },
  {
    "id": "otter",
    "label": "수달",
    "src": "/avatars/otter.webp"
  },
  {
    "id": "frog",
    "label": "개구리",
    "src": "/avatars/frog.webp"
  },
  {
    "id": "lion",
    "label": "사자",
    "src": "/avatars/lion.webp"
  },
  {
    "id": "raccoon",
    "label": "너구리",
    "src": "/avatars/raccoon.webp"
  },
  {
    "id": "red-panda",
    "label": "레서판다",
    "src": "/avatars/red-panda.webp"
  },
  {
    "id": "seal",
    "label": "물범",
    "src": "/avatars/seal.webp"
  },
  {
    "id": "hamster",
    "label": "햄스터",
    "src": "/avatars/hamster.webp"
  },
  {
    "id": "deer",
    "label": "사슴",
    "src": "/avatars/deer.webp"
  },
  {
    "id": "capybara",
    "label": "카피바라",
    "src": "/avatars/capybara.webp"
  },
  {
    "id": "wolf",
    "label": "늑대",
    "src": "/avatars/wolf.webp"
  }
] as const;

export function findAvatar(id: unknown) {
  return AVATARS.find((avatar) => avatar.id === id);
}
