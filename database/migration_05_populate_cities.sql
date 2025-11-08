-- Migration 5: Populate Cities Table
-- Inserting all major Polish cities (all cities with 10,000+ population)

INSERT INTO cities (city) VALUES
-- Major cities (500,000+)
('Warsaw'), ('Kraków'), ('Łódź'), ('Wrocław'), ('Poznań'),
('Gdańsk'), ('Szczecin'), ('Bydgoszcz'), ('Lublin'), ('Katowice'),

-- Large cities (200,000 - 500,000)
('Białystok'), ('Gdynia'), ('Częstochowa'), ('Radom'), ('Sosnowiec'),
('Toruń'), ('Kielce'), ('Gliwice'), ('Zabrze'), ('Bytom'),
('Olsztyn'), ('Bielsko-Biała'), ('Rzeszów'), ('Ruda Śląska'), ('Rybnik'),

-- Medium cities (100,000 - 200,000)
('Tychy'), ('Dąbrowa Górnicza'), ('Płock'), ('Elbląg'), ('Opole'),
('Gorzów Wielkopolski'), ('Wałbrzych'), ('Włocławek'), ('Tarnów'), ('Chorzów'),
('Koszalin'), ('Kalisz'), ('Legnica'), ('Grudziądz'), ('Słupsk'),
('Jaworzno'), ('Jastrzębie-Zdrój'), ('Jelenia Góra'), ('Nowy Sącz'), ('Konin'),

-- Smaller cities (50,000 - 100,000)
('Siedlce'), ('Piła'), ('Piotrków Trybunalski'), ('Inowrocław'), ('Lubin'),
('Ostrów Wielkopolski'), ('Suwałki'), ('Stargard'), ('Gniezno'), ('Ostrowiec Świętokrzyski'),
('Siemianowice Śląskie'), ('Głogów'), ('Pabianice'), ('Leszno'), ('Żory'),
('Zamość'), ('Pruszków'), ('Łomża'), ('Ełk'), ('Mielec'),
('Tarnowskie Góry'), ('Tomaszów Mazowiecki'), ('Chełm'), ('Przemyśl'), ('Stalowa Wola'),
('Kędzierzyn-Koźle'), ('Kołobrzeg'), ('Raciborz'), ('Biała Podlaska'), ('Ostrołęka'),
('Świdnica'), ('Zawiercie'), ('Legionowo'), ('Tczew'), ('Bełchatów'),
('Mińsk Mazowiecki'), ('Puławy'), ('Wejherowo'), ('Starachowice'), ('Otwock'),
('Skarżysko-Kamienna'), ('Skierniewice'), ('Starogard Gdański'), ('Zgierz'), ('Racibórz'),
('Tarnobrzeg'), ('Będzin'), ('Wodzisław Śląski'), ('Knurów'), ('Zielona Góra'),

-- Cities (30,000 - 50,000)
('Kutno'), ('Świętochłowice'), ('Czeladź'), ('Nowa Sól'), ('Piaseczno'),
('Bolesławiec'), ('Oświęcim'), ('Sanok'), ('Krosno'), ('Mysłowice'),
('Rumia'), ('Żyrardów'), ('Sopot'), ('Działdowo'), ('Czerwionka-Leszczyny'),
('Ciechanów'), ('Sieradz'), ('Szczecinek'), ('Brodnica'), ('Wałcz'),
('Dzierżoniów'), ('Chojnice'), ('Świdnik'), ('Mikołów'), ('Luboń'),
('Zduńska Wola'), ('Oborniki'), ('Grodzisk Mazowiecki'), ('Ząbkowice Śląskie'), ('Świnoujście'),
('Jarosław'), ('Łuków'), ('Kłodzko'), ('Józefów'), ('Olkusz'),
('Dębica'), ('Malbork'), ('Kraśnik'), ('Poznań'), ('Hajnówka'),

-- Cities (20,000 - 30,000)
('Września'), ('Brzeg'), ('Nysa'), ('Orzesze'), ('Jarocin'),
('Wieluń'), ('Swarzędz'), ('Sucha Beskidzka'), ('Kwidzyn'), ('Drawsko Pomorskie'),
('Jasło'), ('Giżycko'), ('Cieszyn'), ('Zakopane'), ('Łowicz'),
('Andrychów'), ('Prudnik'), ('Kowary'), ('Śrem'), ('Bartoszyce'),
('Grudziądz'), ('Wągrowiec'), ('Chrzanów'), ('Nakło nad Notecią'), ('Brzeziny'),
('Augustów'), ('Lidzbark Warmiński'), ('Nisko'), ('Kartuzy'), ('Turek'),
('Gorlice'), ('Przeworsk'), ('Libiąż'), ('Kluczbork'), ('Złotoryja'),
('Wołomin'), ('Choszczno'), ('Radzyń Podlaski'), ('Końskie'), ('Świdwin'),
('Człuchów'), ('Lubliniec'), ('Miechów'), ('Wadowice'), ('Pszów'),

-- Cities (10,000 - 20,000)
('Lidzbark'), ('Pieszyce'), ('Leżajsk'), ('Szczytno'), ('Kozienice'),
('Braniewo'), ('Środa Wielkopolska'), ('Władysławowo'), ('Dęblin'), ('Strzelce Opolskie'),
('Gryfino'), ('Oleśnica'), ('Ropczyce'), ('Wyszków'), ('Krapkowice'),
('Pruszcz Gdański'), ('Góra'), ('Rypin'), ('Grójec'), ('Żary'),
('Strzelin'), ('Kórnik'), ('Nowa Ruda'), ('Międzyrzecz'), ('Kobyłka'),
('Ustka'), ('Żagań'), ('Marki'), ('Opoczno'), ('Pszczyna'),
('Jastrowie'), ('Pleszew'), ('Bieruń'), ('Kamień Pomorski'), ('Chełmno'),
('Skwierzyna'), ('Bochnia'), ('Myszków'), ('Konstantynów Łódzki'), ('Grajewo'),
('Bnin'), ('Łask'), ('Luboń'), ('Krotoszyn'), ('Człopa'),
('Kępno'), ('Wieruszów'), ('Kazimierza Wielka'), ('Koło'), ('Szamotuły'),
('Zgorzelec'), ('Łęczyca'), ('Łańcut'), ('Nowy Dwór Mazowiecki'), ('Wolsztyn'),
('Biłgoraj'), ('Skała'), ('Stawiski'), ('Mława'), ('Sokołów Podlaski'),
('Sokółka'), ('Radlin'), ('Książ Wielkopolski'), ('Puck'), ('Kobylin'),
('Dobrodzień'), ('Łabiszyn'), ('Lębork'), ('Krośniewice'), ('Wronki'),
('Łapy'), ('Lubawa'), ('Koziegłowy'), ('Pakość'), ('Dąbrowa Białostocka'),
('Tuszyn'), ('Krynki'), ('Szprotawa'), ('Ostróda'), ('Krasnystaw'),
('Sochaczew'), ('Garwolin'), ('Lubartów'), ('Wołów'), ('Sokołów Małopolski')
ON CONFLICT (city) DO NOTHING;

-- Migration complete!
