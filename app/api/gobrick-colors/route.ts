import { NextResponse } from "next/server";

type GoBrickColorItem = {
  id: number;
  lego: string | null;
  bricklink: string | null;
  lego_available: boolean;
  hex: string | null;
};

const RAW_COLORS = `Lego\tBricklink\tlego_available\thex
Bright red\tRed\tTRUE\tff0000
Light Purple\tBright Pink\tTRUE\tf6adcd
Bright Purple\tDark Pink\tTRUE\te95da2
Bright reddish violet\tMagenta\tTRUE\tb51c7d
Dark red\tDark Red\tTRUE\t7f131b
Orchid pink\t\tFALSE\tf2c6cf
Vibrant Coral\tCoral\tTRUE\tff5869
Bright orange\tOrange\tTRUE\tf57d20
Wheat\t\tFALSE\tefdbb2
Cookies and cream\t\tFALSE\tecd898
Bright yellow\tYellow\tTRUE\tffcd03
Brick yellow\tTan\tTRUE\tddc48e
Light Nougat\tLight Flesh\tTRUE\tf2e0bd
Cool Yellow\tBright Light Yellow\tTRUE\tfff579
Sand yellow\tDark Tan\tTRUE\t947e5f
Warm Gold\tPearl Gold\tTRUE\t947e5f
Flame yellowish orange\tBright Light Orange\tTRUE\tfbab18
Bright gold\t\tFALSE\tb88746
Nougat\tNougat\tTRUE\tdd8c59
Dark green\tGreen\tTRUE\t9247
Army green\t\tFALSE\t555631
Br. yellowish green\tLime\tTRUE\t9aca3c
Bright Green\tBright Green\tTRUE\t00af4d
Spring Yellow Green\tYellowish Green\tTRUE\td9e4a7
Aqua\tLight Aqua\tTRUE\tc1e4da
Medium Azure\tMedium Azure\tTRUE\t00bed3
Earth Green\tDark Green\tTRUE\t004a2d
Sand green\tSand Green\tTRUE\ta0bcac
Olive Green\tOlive Green\tTRUE\t7c9150
Bright Blue\tBlue\tTRUE\t006cb7
Dark Azur\tDark Azure\tTRUE\t00a3da
Medium blue\tMedium Blue\tTRUE\t489ece
Light Royal blue\tBright Light Blue\tTRUE\t78bfea
Sand blue\tSand Blue\tTRUE\t7a89c0
Earth blue\tDark Blue\tTRUE\t00395e
Light grayish blue\t\tFALSE\tcbd3eb
Medium Lilac\tDark Purple\tTRUE\t4c2f92
Medium Lavender\tMedium Lavender\tTRUE\t9675b4
Lavender\tLavender\tTRUE\tbca6d0
Languid lavender\t\tFALSE\tdecde7
Medium stone grey\tLight Bluish Gray\tTRUE\ta0a19f
Dark stone grey\tDark Bluish Gray\tTRUE\t646767
Silver Metallic\tFlat Silver\tTRUE\t999999
Black\tBlack\tTRUE\t000000
Reddish Brown\tReddish Brown\tTRUE\t692e14
Dark Brown\tDark Brown\tTRUE\t3b180d
Dark Orange\tDark Orange\tTRUE\ta65322
Medium Nougat\tMedium Dark Flesh\tTRUE\taf7446
Orange Brown\t\tFALSE\tc3781f
White\tWhite\tTRUE\tf6f6f2
Milky White\t\tFALSE\tffffff
Greyish White\t\tFALSE\td9d9d6
Tr. Red\tTrans Red\tTRUE\tcd544b
Tr. Medi. reddish violet\tTrans Dark Pink\tTRUE\te4adc8
Tr. Bright Orange\tTrans Orange\tTRUE\tffcc00
Tr. Yellow\tTrans Yellow\tTRUE\tf7f18d
Tr. Green\tTrans Green\tTRUE\t84b68d
Tr. Flu. Green\tTrans Neon Green\tTRUE\tccff66
Tr. Blue\tTrans Dark Blue\tTRUE\t7bb6e8
Tr. Lg blue\tTrans Light Blue\tTRUE\tb4d2e3
Tr. Bright bluish violet\tTrans Purple\tTRUE\ta5a5cb
Tr. Brown\tTrans Black\tTRUE\tbfb7b1
Transparent\tTrans Clear\tTRUE\tececec`;

function parseGoBrickColors(raw: string): GoBrickColorItem[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map((line, index) => {
    const cells = line.split("\t");
    const legoRaw = String(cells[0] ?? "").trim();
    const bricklinkRaw = String(cells[1] ?? "").trim();
    const legoAvailableRaw = String(cells[2] ?? "").trim().toUpperCase();
    const hexRaw = String(cells[3] ?? "").trim().replace("#", "");

    return {
      id: index + 1,
      lego: legoRaw || null,
      bricklink: bricklinkRaw || null,
      lego_available: legoAvailableRaw === "TRUE",
      hex: hexRaw || null,
    };
  });
}

export async function GET() {
  const colors = parseGoBrickColors(RAW_COLORS);
  return NextResponse.json({ colors });
}
