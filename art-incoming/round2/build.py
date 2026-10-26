# fully hand-drawn west-facing Amazon profile, south palette only; east = mirror
from PIL import Image
P = {'O': 0x302820, 'K': 0x101008, '1': 0xa0833b, '2': 0xbe9f45, '3': 0xdbbb4f, '4': 0xf9d759, 'h': 0x836832,
     'g': 0x3a6740, 'G': 0x74b54f, 'L': 0x91dc57, 's': 0x875124, 'S': 0xc7823f, 'T': 0xdc9e57,
     'b': 0x38408f, 'B': 0x5260b6, 'c': 0x6284c8, 'C': 0x72a8da, 'D': 0x99c8e8,
     'W': 0xf8f8e9, 'w': 0xb4cac0, 'm': 0x737c72, 'n': 0x515249,
     'e': 0x578e47, 'r': 0x875124, 'd': 0x684c30, 'E': 0x74b54f, 'F': 0x91dc57, 'A': 0xa8ec62}
ROWS = {
 6: "..............OO.OO",
 7: ".............O34O432O",
 8: "............O23441321O",
 9: "...........O234312221O",
10: "..........OLLGGGGg121O",
11: "..........OTTTS213G21O",
12: ".........OTKTSS2O4g11O",
13: "........OTTKSSd231221O",
14: ".........OSTSSd212K21O",
15: "..........OSSdK212121O",
16: "...........OSdCK2121O",
17: "...........OCCKBb11O",
18: "..........ODCTSKbbO",
19: "...........OCTSKbbO",
20: "...........OnTSnnKO",
21: "...........OWTSKwmO",
22: "..........OWWTSwwmO",
23: "..........OWWSdwmmO",
24: "...........OWWwmmKO",
25: "............OTSKSdO",
26: "............OTSKSdO",
27: "...........OFEEKeeO",
28: "..........OFAEEKeeO",
29: "..........OEEEeeeeO",
30: "..........OOOOOOOOO",
}
im = Image.new("RGBA", (32, 32))
for y, row in ROWS.items():
    for x, ch in enumerate(row):
        if ch != '.':
            c = P[ch]; im.putpixel((x, y), ((c >> 16) & 255, (c >> 8) & 255, c & 255, 255))
im.save("attempts/amazon-13/west.png")
im.transpose(Image.FLIP_LEFT_RIGHT).save("attempts/amazon-13/east.png")
