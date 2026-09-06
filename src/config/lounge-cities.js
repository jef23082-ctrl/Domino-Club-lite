// Territories selected explicitly by the club owner; not inferred from appearance.
export const PLAYER_TERRITORIES = Object.freeze({
  christopher:'France',emmanuelle:'France',khalil:'Maroc',eddy:'Martinique',
  'jean-claude':'Martinique',cedric:'Guadeloupe',alexis:'Bulgarie',thomas:'Corse',
  ryad:'Algérie',kyllian:'Suriname'
});
// Twenty cities/communes/localities per territory, including smaller Surinamese settlements.
export const LOUNGE_CITIES = Object.freeze(Object.fromEntries(Object.entries({
  France:['Paris','Lyon','Marseille','Bordeaux','Toulouse','Lille','Nantes','Strasbourg','Nice','Montpellier','Rennes','Rouen','Reims','Dijon','Tours','Angers','Grenoble','Annecy','La Rochelle','Avignon'],
  Maroc:['Casablanca','Rabat','Marrakech','Fès','Tanger','Agadir','Meknès','Oujda','Tétouan','Essaouira','Safi','El Jadida','Kénitra','Nador','Ouarzazate','Chefchaouen','Ifrane','Taza','Béni Mellal','Taroudant'],
  Martinique:['Fort-de-France','Le Lamentin','Schœlcher','Le Robert','Le François','Ducos','Saint-Joseph','Sainte-Marie','La Trinité','Rivière-Pilote','Rivière-Salée','Le Marin','Sainte-Anne','Les Trois-Îlets','Les Anses-d’Arlet','Le Diamant','Saint-Pierre','Le Carbet','Le Morne-Rouge','Le Vauclin'],
  Guadeloupe:['Basse-Terre','Pointe-à-Pitre','Les Abymes','Baie-Mahault','Le Gosier','Sainte-Anne','Saint-François','Le Moule','Morne-à-l’Eau','Petit-Canal','Port-Louis','Anse-Bertrand','Lamentin','Sainte-Rose','Deshaies','Pointe-Noire','Bouillante','Vieux-Habitants','Capesterre-Belle-Eau','Trois-Rivières'],
  Bulgarie:['Sofia','Plovdiv','Varna','Bourgas','Roussé','Stara Zagora','Pleven','Sliven','Dobritch','Choumen','Pernik','Haskovo','Yambol','Pazardjik','Blagoevgrad','Veliko Tarnovo','Vratsa','Gabrovo','Kazanlak','Vidin'],
  Corse:['Ajaccio','Bastia','Porto-Vecchio','Bonifacio','Calvi','Corte','L’Île-Rousse','Sartène','Propriano','Saint-Florent','Piana','Cargèse','Vico','Ota','Sari-Solenzara','Aléria','Ghisonaccia','Cervione','Rogliano','Lumio'],
  Algérie:['Alger','Oran','Constantine','Annaba','Tlemcen','Béjaïa','Sétif','Batna','Biskra','Blida','Chlef','Mostaganem','Skikda','Jijel','Tizi Ouzou','Bouira','Médéa','Ghardaïa','Tamanrasset','Tébessa'],
  Suriname:['Paramaribo','Albina','Moengo','Lelydorp','Nieuw Nickerie','Nieuw Amsterdam','Groningen','Domburg','Totness','Wageningen','Meerzorg','Tamanredjo','Apoera','Zanderij','Brownsweg','Berg en Dal','Pokigron','Afobaka','Patamacca','Kraka']
}).map(([territory,cities])=>[territory,Object.freeze(cities)])));
