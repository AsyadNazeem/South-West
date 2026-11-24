'use strict';

// Developer-managed website theme registry.
// Add new storefront theme definitions here.
// Activation status is managed separately in the database.

module.exports = [
    {
        "name": "Christmas",
        "slug": "christmas",
        "description": "Festive Christmas theme with seasonal colours, realistic garlands, snowfall and flying Santa.",
        "config": {
            "colors": {
                "primary": "#a51f2b",
                "primaryHover": "#841722",
                "primaryLight": "#c43b45",
                "accent": "#d5b56a",
                "accentDeep": "#b38b39",
                "pageBg": "#fffdfb",
                "surface": "#ffffff",
                "surfaceMuted": "#f8eeee",
                "text": "#252020",
                "textMuted": "#756565",
                "border": "#eadcda",
                "focus": "#a51f2b"
            },
            "effects": {
                "snowfall": true,
                "santaFlight": true
            },
            "decorations": {
                "trees": true,
                "bells": true,
                "lanterns": false,
                "crescent": false
            }
        }
    },
    {
        "name": "Ramadan",
        "slug": "ramadan",
        "description": "Deep emerald and ivory with illuminated brass lanterns, gold crescents and a gentle evening sway.",
        "config": {
            "colors": {
                "primary": "#103D32",
                "primaryHover": "#082820",
                "primaryLight": "#276852",
                "accent": "#D4AF37",
                "accentDeep": "#76591F",
                "pageBg": "#FFFDF7",
                "surface": "#FFFFFF",
                "surfaceMuted": "#F8F1E4",
                "text": "#192D26",
                "textMuted": "#53675D",
                "border": "#DFD9C8",
                "focus": "#22684F"
            },
            "effects": {
                "lanternSway": true
            },
            "decorations": {
                "trees": false,
                "bells": false,
                "lanterns": true,
                "crescent": true
            }
        }
    },
    {
        "name": "Eid",
        "slug": "eid",
        "description": "A celebration in royal blue, champagne pearls and gold, with illuminated lanterns, wrapped gifts and floating stars.",
        "config": {
            "colors": {
                "primary": "#193D82",
                "primaryHover": "#102856",
                "primaryLight": "#4264A1",
                "accent": "#E1C891",
                "accentDeep": "#8A692E",
                "pageBg": "#F6F6FA",
                "surface": "#FFFDFA",
                "surfaceMuted": "#EEF0F7",
                "text": "#172841",
                "textMuted": "#526078",
                "border": "#DCD1BB",
                "focus": "#254C95"
            },
            "effects": {
                "ornamentSway": true,
                "confetti": true
            },
            "decorations": {
                "lanterns": true,
                "crescent": true
            }
        }
    },
    {
        "name": "Valentine's Day",
        "slug": "valentines-day",
        "description": "Burgundy roses, blush petals and champagne details.",
        "config": {
            "colors": {
                "primary": "#762138",
                "primaryHover": "#541629",
                "primaryLight": "#96445D",
                "accent": "#E5C293",
                "accentDeep": "#916744",
                "pageBg": "#FFF8F8",
                "surface": "#FFFCFA",
                "surfaceMuted": "#F9E8EB",
                "text": "#3C202A",
                "textMuted": "#795766",
                "border": "#E4CDD0",
                "focus": "#762138"
            },
            "effects": {
                "petals": true
            },
            "decorations": {
                "trees": false,
                "bells": false,
                "lanterns": false,
                "crescent": false
            }
        }
    },
    {
        "name": "Black Friday",
        "slug": "black-friday",
        "description": "A bold dark theme for Black Friday promotions.",
        "config": {
            "colors": {
                "primary": "#171717",
                "primaryHover": "#000000",
                "primaryLight": "#3a3a3a",
                "accent": "#f5c542",
                "accentDeep": "#d49d12",
                "pageBg": "#f7f7f7",
                "surface": "#ffffff",
                "surfaceMuted": "#eeeeee",
                "text": "#171717",
                "textMuted": "#686868",
                "border": "#dedede",
                "focus": "#d49d12"
            },
            "effects": {
                "snowfall": false,
                "santaFlight": false
            },
            "decorations": {
                "trees": false,
                "bells": false,
                "lanterns": false,
                "crescent": false
            }
        }
    },
    {
        "name": "New Year",
        "slug": "new-year",
        "description": "Midnight blue and champagne gold with a panoramic fireworks greeting, animated starbursts and foil ribbons.",
        "config": {
            "colors": {
                "primary": "#26345f",
                "primaryHover": "#192344",
                "primaryLight": "#435a96",
                "accent": "#e3bd62",
                "accentDeep": "#b58b35",
                "pageBg": "#fafaff",
                "surface": "#ffffff",
                "surfaceMuted": "#f0f1fa",
                "text": "#20243a",
                "textMuted": "#72758b",
                "border": "#dfe1ee",
                "focus": "#26345f"
            },
            "effects": {
                "fireworks": true
            },
            "decorations": {
                "ribbons": true
            }
        }
    },
    {
        "name": "Sinhala and Tamil New Year",
        "slug": "sinhala-tamil-new-year",
        "description": "සිංහල හා දෙමළ අලුත් අවුරුද්ද · Brass oil lamps, mango leaves, Erabadu blossoms and kolam.",
        "config": {
            "effects": {
                "petals": true
            },
            "decorations": {
                "garlands": true
            },
            "colors": {
                "primary": "#8B241D",
                "primaryHover": "#611C17",
                "primaryLight": "#C53D32",
                "accent": "#D4A017",
                "accentDeep": "#815D13",
                "pageBg": "#FFF9EF",
                "surface": "#FFF4DC",
                "surfaceMuted": "#F5E9CB",
                "text": "#36251C",
                "textMuted": "#6E5849",
                "border": "#D8BC84",
                "focus": "#426B35"
            }
        }
    }
];
