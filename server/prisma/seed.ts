import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_USERS = [
  { username: "AlexN", fullName: "Alex N.", email: "alex@example.com", country: "KE", blitz: 1548, bullet: 1490, rapid: 1602, classical: 1580, games: 327, wins: 181, draws: 42 },
  { username: "MagnusFan", fullName: "Erik Solberg", email: "erik@example.com", country: "NO", blitz: 2389, bullet: 2412, rapid: 2350, classical: 2290, games: 582, wins: 401, draws: 98 },
  { username: "QueenGambit", fullName: "Beth H.", email: "beth@example.com", country: "US", blitz: 2201, bullet: 2100, rapid: 2260, classical: 2310, games: 421, wins: 280, draws: 70 },
  { username: "NairobiRook", fullName: "Brian Kamau", email: "brian@example.com", country: "KE", blitz: 1602, bullet: 1550, rapid: 1580, classical: 1490, games: 391, wins: 210, draws: 55 },
  { username: "SicilianSam", fullName: "Samira K.", email: "samira@example.com", country: "EG", blitz: 1890, bullet: 1820, rapid: 1910, classical: 1875, games: 260, wins: 150, draws: 40 },
  { username: "KnightRider", fullName: "Tomasz W.", email: "tomasz@example.com", country: "PL", blitz: 1720, bullet: 1690, rapid: 1750, classical: 1700, games: 198, wins: 100, draws: 30 },
];

async function main() {
  const passwordHash = await bcrypt.hash("Password123", 12);

  for (const u of DEMO_USERS) {
    const usernameLower = u.username.toLowerCase();
    const emailLower = u.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { usernameLower } });
    if (existing) continue;

    const losses = Math.max(0, u.games - u.wins - u.draws);

    await prisma.user.create({
      data: {
        username: u.username,
        usernameLower,
        fullName: u.fullName,
        email: u.email,
        emailLower,
        passwordHash,
        country: u.country,
        rating: {
          create: {
            bulletRating: u.bullet,
            blitzRating: u.blitz,
            rapidRating: u.rapid,
            classicalRating: u.classical,
            highestRating: Math.max(u.bullet, u.blitz, u.rapid, u.classical),
            gamesPlayed: u.games,
            wins: u.wins,
            draws: u.draws,
            losses,
            currentStreak: 4,
          },
        },
        settings: { create: {} },
      },
    });
    console.log(`Seeded user ${u.username} (password: Password123)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
