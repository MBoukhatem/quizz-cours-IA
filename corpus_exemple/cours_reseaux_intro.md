# Cours : Introduction aux réseaux informatiques

## Chapitre 1 — Définitions de base

Un **réseau informatique** est un ensemble d'ordinateurs et de périphériques reliés entre eux et capables d'échanger des données. Les réseaux permettent le partage de ressources (fichiers, imprimantes, accès Internet) et la communication entre machines.

On distingue plusieurs catégories selon l'échelle géographique :

- **LAN** (Local Area Network) : réseau local, limité à un bâtiment ou à un campus.
- **MAN** (Metropolitan Area Network) : réseau à l'échelle d'une ville.
- **WAN** (Wide Area Network) : réseau étendu, à l'échelle d'un pays ou du monde. Internet est le plus grand WAN.

## Chapitre 2 — Le modèle OSI

Le modèle OSI (Open Systems Interconnection) découpe les communications réseau en 7 couches, de bas en haut :

1. **Physique** — transmission des bits sur le support (câble, ondes).
2. **Liaison** — trames, contrôle d'erreur, MAC.
3. **Réseau** — adressage logique et routage (IP).
4. **Transport** — acheminement de bout en bout (TCP, UDP).
5. **Session** — gestion des sessions entre applications.
6. **Présentation** — encodage, chiffrement, compression.
7. **Application** — protocoles applicatifs (HTTP, SMTP, FTP).

Chaque couche n'interagit qu'avec la couche immédiatement supérieure et inférieure.

## Chapitre 3 — TCP et UDP

Le protocole **TCP** (Transmission Control Protocol) est orienté connexion et fiable. Il garantit la livraison ordonnée des paquets et retransmet en cas de perte. Il est utilisé par HTTP, HTTPS, SMTP, SSH, FTP.

Le protocole **UDP** (User Datagram Protocol) est sans connexion et non fiable. Il offre un débit élevé et une faible latence, au prix d'éventuelles pertes. Il est utilisé pour la VoIP, le streaming vidéo et les jeux en ligne.

L'établissement d'une connexion TCP utilise un échange en trois temps (three-way handshake) : SYN, SYN-ACK, ACK.

## Chapitre 4 — Adressage IP

Une **adresse IPv4** est composée de 4 octets (32 bits), notée en décimal pointé : `192.168.1.10`. Elle identifie une machine sur un réseau.

Les adresses sont divisées en deux parties : la partie **réseau** et la partie **hôte**. Le **masque de sous-réseau** indique combien de bits sont consacrés à chaque partie. Par exemple, `255.255.255.0` (ou `/24`) signifie 24 bits pour le réseau et 8 bits pour les hôtes.

Certaines plages sont réservées aux réseaux privés (RFC 1918) :

- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`

**IPv6** utilise 128 bits, ce qui permet un nombre d'adresses largement supérieur à IPv4. Une adresse IPv6 est notée en hexadécimal, par groupes de 16 bits séparés par des deux-points.

## Chapitre 5 — DNS et HTTP

Le **DNS** (Domain Name System) résout des noms de domaines en adresses IP. Quand un navigateur demande `www.exemple.fr`, il interroge un serveur DNS qui retourne l'adresse IP correspondante.

Le protocole **HTTP** (HyperText Transfer Protocol) est un protocole applicatif de niveau 7. Il fonctionne en requête / réponse et est sans état. Les méthodes principales sont `GET` (lire), `POST` (créer), `PUT` (mettre à jour), `DELETE` (supprimer).

**HTTPS** est HTTP encapsulé dans TLS, qui chiffre les échanges et authentifie le serveur via un certificat.

## Chapitre 6 — Sécurité réseau

Un **pare-feu** filtre le trafic entre deux réseaux en fonction de règles (adresse source, destination, port, protocole). Il peut être stateful, c'est-à-dire mémoriser l'état des connexions.

Le **chiffrement symétrique** utilise une seule clé pour chiffrer et déchiffrer (AES). Le **chiffrement asymétrique** utilise une paire de clés publique / privée (RSA, ECC). En pratique, TLS combine les deux : asymétrique pour échanger une clé de session, puis symétrique pour le trafic.

Les attaques courantes incluent : le **déni de service** (DoS), l'**homme du milieu** (MITM), l'**injection SQL**, et le **phishing**.
