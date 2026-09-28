/**
 * NÁVOD PRO KLIENTY STUDIA - ANGLICKY (zadání 25. 9. 2026: „uděláš mi rovnou
 * k tomu návod s obrázkama v angličtině pro ty uživatele").
 *
 * JEDINÝ NÁVOD V PORTÁLU, KTERÝ JE CELÝ ANGLICKY. Čte ho muzikant nebo
 * producent z Londýna, ne náš tým - a překlad tam a zpátky by jen přidal
 * místo, kde se dvě verze rozejdou.
 *
 * ČTE SE NA /studio/napoveda, ne v portálové Nápovědě: klient studia se do
 * portálu vůbec nedostane (layout ho pošle rovnou na kalendář).
 *
 * OBRÁZKY jsou v public/navody/studio-booking-1..5.png. Nejsou to snímky
 * cizích rezervací - kreslí se z repliky scripts/navody/studio-booking.html:
 *   node scripts/navody/snimky.mjs studio-booking
 * Růžová čísla v replice patří k číslovaným popiskům pod obrázkem. Když se
 * kalendář změní, upravit repliku, přegenerovat a srovnat text níž.
 *
 * DOPLNIT OBRÁZEK (28. 9. 2026): plánování víc termínů najednou zatím obrázek
 * nemá - replika scripts/navody/studio-booking.html se k němu musí rozšířit
 * a snímky přegenerovat. Text níž na obrázku nestojí, takže návod dává smysl
 * i do té doby.
 *
 * POZOR: text je šablonový literál - žádné zpětné apostrofy uvnitř, jinak
 * spadne seed při nasazení (stalo se 25. 9. 2026 u mapy portálu).
 */
export const STUDIO_BOOKING = {
  slug: 'studio-booking',
  nazev: 'Booking the studio',
  perex: 'How to book studio time, take whole days for a longer project and put the calendar on your phone.',
  kategorie: 'Studio',
  poradi: 10,
  proRole: ['BOOKING'],
  obsah: `Welcome. This calendar is yours to book our studio with — no e-mails back and forth, no waiting for a reply. **What you take is yours the moment you tap Book it.**

![The booking calendar: a week of the studio with your own bookings in purple and everyone else's time in grey](/navody/studio-booking-1.png)

1. **Free time** is the light purple area inside the opening hours. Tap anywhere in it to book.
2. **Your bookings** are purple and carry the name you gave them. Tap one to open it.
3. **Busy** is everything else — other clients, our own recording sessions, maintenance. You see that the studio is taken, never by whom or what for.
4. **Week or Day** switches the view. On a phone the calendar opens in Day view; on a computer it starts with the whole week.

The arrows move a week (or a day) back and forth, **Today** brings you home. Every time on this screen is **studio local time**, wherever in the world you are looking from.

# Booking a few hours

Tap a free slot and the booking window opens with that time already filled in.

![The New booking window with the date, the from and to times, the booking name and a note](/navody/studio-booking-2.png)

1. **By the hour** is the normal way to book — a morning, an afternoon, a full day of tracking.
2. **Date** — change it if you tapped the wrong day; you do not have to close the window.
3. **From and To** offer every half hour inside the opening hours. The shortest booking the studio takes is shown under the calendar.
4. **Booking name** is what you will see in the calendar. Only you and our team can read it — everyone else sees the word *Busy*.
5. **Note for the studio** is optional and goes straight to the team: what you are bringing, what you need set up, when you plan to arrive.

Then **Book it**. The slot turns purple, the studio is yours, and our team gets the booking in the studio diary at the same moment.

# Booking several sessions in one go

Booking four afternoons one at a time works, but it sends you four separate confirmation emails. **Add to plan** does the same job in one.

1. Tap a free slot, fill in the name and the times as usual, then press **Add to plan** instead of Book it.
2. The slot moves into a **Plan** panel above the calendar. Nothing is booked yet — the studio is not held and anyone else can still take that time.
3. Repeat for as many slots as you need. Any day, any week; they do not have to be next to each other.
4. When the list is right, press **Book all**. Everything goes through in one go and **one confirmation email** arrives with all the sessions on it.

You can drop a slot from the plan with the **×** next to it, or clear the whole list. Nothing you do in the plan touches the calendar until you press Book all.

If one of the slots gets taken while you are still planning, **nothing is booked** and the calendar marks the slot that no longer works in red. Remove it, or pick another time, and press Book all again — you will not end up with half a booking and no idea which half.

# Taking whole days for a longer project

Mixing an album takes more than an afternoon. Switch the window to **Whole days** and give it a range.

![The New booking window in Whole days mode, with a start date and an end date](/navody/studio-booking-3.png)

1. **Whole days** books the **full opening hours** of each day, not midnight to midnight — the studio is closed overnight anyway.
2. **Until** is the last day of the run. Every open day in between is booked; days when the studio is closed are quietly skipped, so a Sunday in the middle of your range costs you nothing.

If one day in the middle is already taken by someone else, **none of the run is booked** and the calendar tells you which day is in the way. Shorten the range, or take the rest around it — better that than half a booking you have to check day by day. Either way it is one confirmation email, not one per day.

# Changing your mind

![The list of your upcoming bookings and the detail window with the Cancel booking button](/navody/studio-booking-4.png)

1. **Your upcoming bookings** sits under the calendar — the quickest way to check what you have coming without hunting through the weeks.
2. **Open** any of them and you get the time, your note, **Change time** and **Cancel booking**.

**Change time** opens the same window you booked with, so you can move the session to another day or another hour without giving up the slot first. The new time has to be free, inside the opening hours and not in the past — the same rules as a new booking.

Cancelling frees the slot straight away for everyone. **A booking that has already started can be neither changed nor cancelled here** — write to us instead and we will work it out.

# Put it on your phone

The calendar is a web app, so it goes on your home screen like any other app and opens full screen, without the browser bars.

![The calendar on a phone, showing a single day](/navody/studio-booking-5.png)

- **iPhone (Safari):** open the calendar, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the calendar, tap the **⋮** menu, then **Add to home screen** or **Install app**.

Stay signed in and it opens straight on this week.

Easiest of all — point your phone camera at this code:

![QR code that opens the studio booking calendar](/navody/studio-booking-qr.png)

There is also a [one-page card to print or forward](/navody/studio-booking-install.pdf) with the same code and both sets of steps.

# Your account and what we email you

Your name sits in the top right corner — tap it and you can change your name and phone number, and choose what lands in your inbox:

- **Booking confirmation** — the details in writing the moment you book.
- **Changed or cancelled booking** — if we ever have to move or cancel your time, you hear it from us straight away.
- **Reminder the day before** — the afternoon before your session.

All three are on to begin with; turn off whatever you do not want. Your email address is also your username, so if that needs changing, write to us.

# A few things worth knowing

- **Your names are private.** Other clients never see what you called a booking, or that it is yours at all. The same holds the other way round — that is why their time shows only as *Busy*.
- **Our sessions are in here too.** When you see grey, the room is genuinely taken, whether by another client or by us.
- **Language.** The **CZ / EN** switch at the top changes the whole calendar; it remembers your choice on that device.
- **Something odd, or a booking you need moved?** Write to us — the fastest fix is usually a message, not a workaround.`,
};
