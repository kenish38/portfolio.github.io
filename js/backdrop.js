// ===== O fundo da página, pintado como uma imagem =====
// Os tons das seções, as luzes e as sombras macias formam um fundo só, calculado aqui com precisão total e pintado pixel
// a pixel na resolução da tela, como um render.
// Por quê: a tela tem 256 tons por cor, e no fundo quase preto um degradê lento tem poucos tons para ir de um lado ao
// outro, então aparece em faixas. Um degradê feito pelo navegador (CSS ou SVG, dá no mesmo) sai em faixas ou com o
// pontilhado em grade que o Chrome põe para disfarçar, e que aparece como granulado. As fotos e os renders ficam lisos
// porque cada pixel já vem com uma variação finíssima que esconde o degrau (é o "dither" do Photoshop). Aqui é igual:
// cada pixel arredonda para o tom de cima ou para o de baixo seguindo uma máscara de ruído azul (void-and-cluster,
// 64 x 64, a mesma para os três canais), que mistura os dois tons por igual, sem grade, sem manchas e sem pontinhos
// coloridos, na proporção exata da cor verdadeira. Esse arredondamento acontece uma vez só, no fim; as luzes e as sombras
// são somadas antes, em precisão total, então somar não granula. Onde o fundo é liso, nada muda: o pixel é o próprio tom.
//
// Cada seção leva o seu pedaço do fundo (no ::before dela, os tons; no ::after, as luzes e as sombras; os dois da largura
// da página: ver "O fundo da página" no fim de css/site.css), então ele anda junto com a seção quando a página muda
// (uma aba que abre, o idioma, as fotos que chegam) e não precisa ser refeito. Dentro da seção, cada pedaço fica preso
// à borda de cima ou à de baixo, a que estiver mais perto do que ele mostra: a passagem para a próxima seção fica presa
// embaixo, a luz do alto fica presa em cima. Quando uma seção cresce, o meio dela (que é o tom liso) só estica. Um
// pedaço só é refeito quando o que ele mostra muda de verdade, e os pedaços prontos ficam guardados para voltar na
// hora. As imagens têm o tamanho exato da tela em pixels (nada é esticado; acima de 2 pixels por ponto, ficam em 2) e
// vão em PNG com paleta (cada pedaço tem poucas cores: um tom e o vizinho dele), que ocupa pouco.
//
// O que entra no fundo vem do CSS ("O fundo da página", no fim de css/site.css):
//   --tone-*          o tom de cada seção (a passagem de um para o outro fica em volta da borda entre elas);
//   --glow-1, 2, 3    as luzes: a forma (a de um radial-gradient), a cor e a força no centro, separadas por "/";
//   --shade           a sombra macia de um quadro, nos números de uma box-shadow: para baixo, desfoque, expansão e força.
// As luzes das seções vão no fundo delas; as da janela da abertura e do quadro da Workstation X, dentro deles.
// A conta roda em Workers (este mesmo arquivo), fora da página. O estúdio 3D (js/studio.js) pede o céu dele aqui também
// (HRBackdrop.sky).
(function () {
  'use strict';

  // ---------- A conta (na página e no Worker) ----------
  // a máscara: a ordem (0 a 4095) em que cada casa de 64 x 64 acende; vira o limiar de arredondamento de cada pixel
  var NOISE_B64 = 'LgRlDQALRQ9WA4QL2AD5CO8COQtTDScHawJpC4EAdQYvC20BlQ3aBpcMUAmmBowKegDlDSoKsgxxD1YAbQQdDtcCNgaWClIDgwWzAH4EVQ9UBmYAVwlVCzQGBwKkCoENlAGjDwIMkANDAeAOugKFBDMPsgWNDO4KHQTeCBcNPgrfDu4BKQcpAMMEow09B6oMzQUlCAMArw+JCHIDGAqJBOEPMQnQC7oENgI2DlwDUA3wB6oESgGfCFAF+QneDDsHpwsECS4AFgy7DegGyAofAqUD6Q3iBK4CrQ/JA4gMMAk2BcoHVQAYDvEFHgiRDdkKDADHA4YIqA5hB8ILVwBWBjMMkwWKCbAMMQhyAhsKgwFPD8AKeATWCWgF/wuWDi8IvgLcBR0AQgpJCEML5ABfBR4J0Q+IAxQLmAJ2BgMPFwFuBZUPgASKCGECuQl9DpwHwQuzCNUGJAoNDXUIggAbBpAOCAQyC28JmgQpDIYBMAc9CSANzQJEASAFoA9aA8wH1wBiDqcDnwqmD6EGTQ71BEsD4wZIDA0Cxg33AEIGpwE/DOMNdgdsD84DNQa0DiAKRQLVC9gGtw5HDI8BGQnaA34KMgJaDX4GSg/ZA+oAYwVGDZ4B6g62AFoEAAfqCxoD7QklDXsCXwdiDyEDXQruBPsPdQvtBu4NXAoxAkoJ3woEBdgIUgL8BVwB7APgC24JdA3rAL0OAAkfBNUH9Ay8CroI8AQPAwgNMgFXDJUHKQT5DLcFFwAoCCME1Q2GBxQMig6+B/cJLwFZC/wHXwwBCcMCcArRBZgLMw6ECdUBUw8PCP4AZwbMDZoAkggGDVMC5AUYAfYD1ggUBnwNPAQaD8YL3wYEDf0NPQuBCGIA5wXrB04K2wLdBUELnA9bAu4DLQ8HAV0L9ggYBa8JsgJUDz8B3QpODs4JeQWrCu0C/QXwAKIDfQxNBd8CJQZZDpUEhA9XB7ADRwiAAmQFeQ13BBALbQzJBKoJiwvmA5MGNA5ACDMKvA7hC2MAgAxRB24BIAOACh4BmgcdBe0OigxOAt4PWATmDBoHUwDICZYFZQceCi4Gdg7pBgYCdw1NC1wG4AhqB28DDAIVDZ0A6A+FCf4NDgfsCBIPHw0aCgkAIwtTAcgM4A35APcPDAp3BzkBtAZsA8oPjgGABfEO8ApKAHQMnQT8AaEHRQNLBZUI8A3wBdIPLQR1CdkCKAqkA6AGKAtWAYgIOw7xC0kDlQ6yAI8NnAIMBGcKrA8dCNIAigTiDRwMCAUMD8UI8QafC+0EWgL9CpUAdQT7AWgIxAPcBp8JDQXiCIUG8Qo6A7gMBQlcDp0KaggRDYcHHgLrCGYDIwdwD6sJzQ3qClsPIAILCiAAMgg9DGUOnwBFByEN5wi3DYEFiQoKAuUELgidDEMJngv6B7cMaQC6BVUDmQ6aCdwCfgGECmAGnwwyBMoBNAh2DZgFpQ7WC0oHyw9GDCIO0QKuC7QBegzHBHQA9g6vBYQCJgAhBhID5Qv8CRMFrQ1eC7UC2gXiAJkGHAkVBAkMwg3mBCcCQAaZCnMPxQG/BBkAHA9fA8oGfg9MAfMF4gMWAiQFOg4NCUAMAgtyBwENDwa/DyAIbgDlAo4OZQpdDLQD8QmDBioDlQotBaIB3gXBB0kPBwSGDmMI5gZUCxsETgx7CZ0NeQRGDpYAPA9XBiEBMglEDOcDFg1oAZ8OEgdgA+sK7QjpDNgDlQV8C9wJgAfmC9MIKQ3PCfwK1w0UB/IPRwp0AcIGXAT9AR4FkwASCgAEig0iC1YJuAWCBxwAog+VARYJCA5kAJMNtAh2C7oAdwpJBn0C8AncDboBMAihDzIHOAtzAbUGowjcA1oKUQ2NBHQH3w9LCGYLHAV2Cf0AgQ9QB0kB+w0pCKUCxg4EBDACCQbdAFsEqgKrCFgAbgvJBwQD9w4nDXQJVg9MCIMMXAIuB8wEPw89AaUNcwT4BmALgwLnB44E0QldAs8OqwQYCcoMFgH9C1sDbAVsCgoBAAMOBQoPrQrJDKwCHwipAcQOuwpFAE0DKAZHAioN8wueBdMCmgutCXgASgxbBqANtwrCDAYPiQc1Dl4MkAWmA4YM9gVzCAoAfQscA4IGOwvWDnABBQxeAy0Ivgu6CT4OagWxDO4OMwb7C7sD8AZjDTIDmQ9iB5sEQgnUDs0Mewb8DTcJ4AcQAqYFlA8pCzMHmwV1AtcI5wzsCT0P7wfBAyUKyQ69BJgG/A+ZA0cJvwAsCDIFHgM2CdkEzgHfCcMOBgH1DcEK9QMmB74NLQFuBOkFhwjUCQoNPgbTARUDjgjjAOgDqgojAT8NOAgNC1kAYgijBVQKCQ4xAJgHMwJiBO8LewBODRIEgAkPAGkMNAQeDtELuwZ1DmwEiACBBkUOyQFuCFsNNwLYBwELUwWYDukBTAoKDIwAKwuID9cGVAiDBKYJOgK0D3EFuwi6DI0JAgPTDUIAIQWQD8sKXQ1pBmEPYwl6B0wD6g/BAScFAQ+/C2EBlAI2DDIGWAvjCCIPLQp3AxMHRgu5DYQGEQNZCcQAIwqSA3sBYQwZCzwJtgwRBwcAxwo9BF4OjAHsDFMHVgS6D5sGqg3SBWkDowqRAnoNxAWiB+sL0ADLDiwC5gruDwYHfAqIAnsHKgR1AC8KtwQhAncMmQUbCYYG5wngAq8GKw0DCScE3A8oA08FTwEaCOUFxg8TAcsEug5tCEINFAWqDxAIAwaeCEUFngIOBIALuQUuCX4MPAasCCkDlAvMCaICuAhUAfsHkQwvAJsOZws4AfIMIwMACqYEsgcSBgsBvARoDLAO8AjtC2sO0gfgDOcKiQ5AANgLlg0XBCQO2ArOBHoO7AbDAbMJpg2RC4QOjwJ2DGsKiAdDAqYKiQH0BjUMHQLMDh0NEQHVD04I6g0tAokPVAPUAFcKZg87AMAFEg5ZDAsERA9YCaEEIwYnCAkEPglSBkMOSAuMA0wNqQs9CMMDSwEXBkECXQU5AycBjAbCAyoItwKcCsAAnAjoAdYHsAB5CusMvQdxAKoGIQSICbgBqgjMA9wMzAUbD10D/gqRBLEJMQN9CiAGyADYCREFugdECyAO+gTrBlkN7Ae1AR8FPApgApEGLQ1GCuYBlg+kDWgATwi3AawOOwmtAjgP3QnrDfoKOw2pCbMPpQi6DcUJfQ/+BD4HFw/YBXkMgA+fA80L8QRID4oDjQo1DUMFLg5DBvIOhQumAOYHyg33CEcArQYnDp8HFwzODqoD1wxpAXwGcQlxAs4L8QOHCUcLhQ5dB70L0wDeDhADMAwMB7IKFwW5DNcFIgchADUFsgbHAOsEyweRAfUGrwujBGQCrQUdDJAB8QxpCXgCkgQHCnQG2QhtAg4GUwygCAEBuAdcCzcA/QIiCUoEKQryAVUFBw2TC6AB0ASHAtQGqQphCDsPEAQcDSsIGgEuD8UCXQaEAHsDmQ0VCGYEwgiCBSYBfwMGCT8Crg/QCSoM+Q3GCswMygjaAqkOAwQaAFsKwwzxAIsHHQt0A6MGDw71C2QB3w0eALUOkAmSAQsO9gKpD5QEDwqDDcsG5g9xDDoGoQ6VA/0HLA9aCWENMwBmBZkCdwutAHQFow6bCtQEUQydCMIPnAl2Bb0KYAHRDMoJEQ+gCxYOfQTbCgkDNwS5B/8BjQPYD0oL9QVqDBkIQg/EBnAO/whwBMUOTQDcCk4HUQMDCKIMXQROC30HawXXCtMGNwwmAgUIAAUVAb8CgQctC/sAYwrrBd8DMwvFD/IINg3BBvUJDwwFAo4GswfmDaYBPwSrDPQBXw+cBikOoQKxBy0GqQDzB4kMgAG9CEwP0wUsCv8GmQCYDQoJuAJaBa4D/wmFAm0NVgh+BTsCIQnxD1wF7gnPBskCbQ/zAz4NNwH1CMUDgw5VCtoLDg5zCaAEnQ+xApQMOgGrB/ILuwFkBOwO+gJsCF8NsgMlABMK1AUgCxYHWAjyAsQELAskAD4EKA06CnAF4g6lBkENMAsSAUcORwS7Cf8EzQGYChAOngBJDFAGGQFoCk4PlgyeBCUL2gF1DewAOQx8CHwA+gkQBiAPvQxbAeEFdggCBBAADw2FCHMGMwk8Dt4Ehwa0DaMJZQBVB5ME1A9oCbgLAg8zA34NbQCuDkIMEgkoB5wMpgj9D+ABhQMTCdEA1QTdAkIHRQzwAeQHHw/HDEkHcQuACHgP5wSqC2gHqAOxBoMApw5vCO0DXw7qBYgKjw60B5cCnwRwB2QLGwNkDwkH1gqdBcwBoQ21AzYKagL0CjgDlwVfC9gMUwogAZEFJgj1Ac4GNQkCBUkK4QP4AEcPsAUDAwML3QZBDDEO+Aq9CQkPlgglBdoNbgqdA1sAogX+AxEC+gYUA3sOeQGMCfMNLgriAj0GigtRCXkC7ATUAd4LvA35CkwATQlpDbMBrQyLAuUOlQt1B30A/w4GCNUAkg+yCGQOsgFaBsUNxgKODGkEKg4jDNEBcgb4DcUKQgKwCW8NNgG+BEgIkAIaBtEDvgwFAD8L/AIdBsALvgiyDyINWwnJDckKSgjODJMCKgURDM8HEA1HAY8HvA/LDOAGmwMVCXsF1g/WA5UGFgUDCjkIjgPCCawELAzKBfwMkQkfB4cEjQL3B/kDMQs2B2gPngqsAEYI2w/UAtsHVwUDDFAEfwd4DgYKQw9wALgNFAgJAp4Gcg9BCfYAkw4FB9ACYgpIAdsFEgAiBCwGww/LCMABZQQmD3IFZQPjCg4A1QkEDwUBJAhjApMKkQ7KC3YAQg4WBjAB9g8MCSkCSwSkC2YBTw37CSsM8w4HCe0ABwV5CUADwgWBC80JTQ14AfoOZQijACoGkwN5CxAH3QS1C3MOUgpBBI4HOQ3YBJ0BZwxvBPYHFQxLD+AJjwunABcHlA2QCrgAtAmrDQoGRQilBEUNSgYoDNgNQAdSAbcIcgRYB8QKtQ3jAp8GoQrVDk8DRgY+D2cFFQAZA78FPw5LAuwLpAeIDUIEBAD2BkkJbQPADS4LwQzkAdQILA1dAUgJEwOJBS4BlwuKAtAKpQnyDYkGpg5YAuEEowcuA6QOawm5A4AGkAwbCOUBzwvHDtICHAvdAVIEKwlGBSsD9QyfDxQCcgwQBWAINA06AJsHlQyRCGIC5ApBB+8M3gkRCMAMOQa5DqwBiwovD+AEuQtfBlECBQWCCXoPjQXCAs8Kkw9MB6cM1A3NCM8PoAXhB0cDvgA1C5oIjA2TAdsMjgUjAmgLmA8GAw8FYQ4eBL0AZAkDB3UPNAocAdcONgsGBhcKygMdCaQAnAsTBEkO6gSqDgIBEww5CaQE4g+LAf8DcwpfALUE/gj+AgsI4QzoALsPoApHBz8A7wPiB2YONwYWBEsAZAgcAmQGvwNrACcMJA9gCaQFqwM7CmEG7Qo6COEN6QQwAPMIQAvSBg4KyAfjDGEFgQMyDagHUAxMAgoI2wADDlgGTQ9gB2gCFgr6COsCzAYYBMQNrwAhC7MGlw3WAoIP4gbMCwQOGAY4ArwJGgSTCG8OGA3bCxUKAAEaCRsMJg4mC7gErQ44CXENAge7BPMBAQz0D1IAVA46BA8BGAz+CVQHkg5CAT0NmgL+D4IBiAvDCDYAHgYsBJMJFA+pBBsL/wJWCjwFeAw8AdAFGQ1RCmsPnQcvA88IMQWNC5EHgQkbDcADxQAMC90OKwdgDCUBPwNbBQ4CtgZcDdYELgKpBnMD2wlaDKoBBgvKAiIKnw0MCL0G8AJcCXMHZQ+EAxkGiQK6CuMDhwX0CzgGSQQKDnoCIw8OCyUOOwEPB6kMgwgxDYoB8Q0NCMcPEQtnADwI9wGpBcYMWA4EAgAPzgDoBBoCSAp1BcgIJgPFBAwOJwbaCu8IzQ4qCycD8A9EChcIGA/KAEYHWAU+CGkOFQYkAU4E7gw8C/gE0AwIAscIFw5rDBIIWA+JCVwAjQi/ChwH4wkzBYUHMAOPCl4FpgILAMAGgQROCSIDlgY2BMoO0gSwC4YJZQEQCtIDHwawCEwMPQ7tB+0PswxsAWEL9Ad/Ap4PNQdnBHkAVwgBBmYMQQGKBVUNAQNQD/IDTgCQC2cPJAk5AuMO2gBPCrUFeAtvANEEmQGrBsMNcAPhDmQM6QDQA7wMlgGCDbkI5Q/EC10O9glgD4kLywA7DCwJXgdzDXoDJQ9uBvkL8QdUDYcKeAMEBl0AJARjBu8JYA0nAHgJBAxjAYwMwwlIDsYBLwQVDuUKeQjfCwIKEg3dCOoGbgPNCu0FaQjNBq4N6gOSB9kPQAn/DGwClwr8BJYHSQLWBaQPdwhjC2oGmAANBMIH4wWWA+wBbwdIBcsNKALFBc4K9AChCHQEOADID7kCLAHmDo4J7gu9DSUCYwc7BWcOJgTuBWMDpw0BBdYGbwsvCQgHrwKcBI8AMQY8AsEEbwyYATkOhARbDOsBFAnCDpICeApTBjgEtgu1CBQBQw00CdENTQq2AnwE+A7LCQoLuQGsDakI+wySCugO1AMxCo8MwQJsDhsHLg1QClkFXAdSC9cE8wbsAqUK5AhXDzcD3go7COkOdgquB18CMQ99Ay8NEAGMD5IJOA6tB8wPYQq2Dd8H0wkUALkPnAPsCqoAPQVeDVgBhw4/BzcPqAXhCjwDvgY8ALwH8AyrBXcCMA4sBXsLhgAvBr0C6gi8BiMA+QdwCT8FagsCAlMDEQ5FCf0M5wF9CCgPQAGPBB8MuwDlDPEByQbeAMkLvAg0AB0KIgUICCQMzwXtAZsLrQPnAG8FfgJvBqYLmQd6BfoMSAclDD8ILAP9CQAAswMLDLwBdA9eBBYLeQ53AeILEAluB0IDngmlD2sELQw+AUUL4A8UDasByAODD9wIDAxMBpIACgSNDrELiAUJDQAIeAYfCqwFIAnbDQgD1w/IBW4Moga/DvcCSwrkA24N9AiKBtMOfgkODPwODANtCvoNZgKyCdMDWg5lC3wFewgGDu8GgwkOCDEMhgXRCMYDvwZyACoPSwxrAa4Gaw2nB08O8gRDA5oFBw6uCn8GiAGoBAsPAQgKCo0GPgMRAMYJlANKDp8Ciw9DBGILQQXhCbEDDQ4qAlYL3ADODR0HHwD/CrMCmQxABH4IVQH2BOYIiQDDBlEPGwE7BscBsA+0DI4CxgSiDZsAzAIeDf4Bzg+xCkANRgToBX8I4gp5A0sJFwIICiAHGQyPCPoArwecDawJ6QLPDLAB6AqGDYoHYw+OC58BkAhUDEQA2QcmDWcBZAdUCbAEpQclCW0FQQ9eCMoELA54B4AAcg4/BqMMjg8oBNIL5AT2ClIJwwdgBHEKRgGCCw0GQwr+DosG0gn5BBwIxwLJCSMOVAL9DkEAswWDCykPtABqCkwEMg9zDGIFwgCMC8sFwQ8GBcwIQALZBXsECgfnDWcDsAaaCm4Cbg72C6UA1gyxD1cD3QtPAoUMUQEFCp8FawuJA6wK1AfCAQ0Kew1xB7QC3g3nCxgDSwcnCWkPaAPQB1MElgtaAOQNDQwwBrwAbQs5BVsHoQzoDfcD7gfuAnwORAYSAkgDJwvQDpgIQwe8A4UARA5QCxQKSw3DAKAJJAvcBDkPCAkmBmgEigrsBb0BwwreBnYEfQlLBvMP4wFEDRcJcwLdDb0FNQOnCM0ADQ+LBUYA2gyeDhkFxgBNDAIOlwELCR4HngPZAUYPKgf3DM8DOArhCCIBYgZwDCgJagBnDV8IHArhBk8EWQIADr8JYwy3BvgDVwHFB/gPfwUiAt0MBAGaA/gHbg/0Av8NmQiFDSoB+w4kDawDEgvNB3EEDg/yBiwAuguMDlEGpgzgA18K/QikBisCOgtFBnEIdAISBSIMsQ6RCqIElAmLCFoB+Q/YAcIEDwuRDzUCKwUYB08L2gTrDygAXgmYDDEBGAvYAkQI2Q7EDPUCoQvVCKIOJQePCb8NbAsTANcJfgflA0IF5Am2B2AA2wiWAjIMuQBpBYIMWAqQBGwJSgIfC9wHvwH6D1EEmg3oCc0DSA16CsAPBQbzAP8HkwxtDh8DhAXvChgIaA47A5cHMA2oCucOFwOuAdkL9AVgDowHCgVPBnkPqAFlBV8JmgayBFQA2wMvDMMF2wEaBUoNcAaEAR4PewzeAqMLlAX2DSEHiw4BCpsI5AK1D+oHKwH0Ds8EYg0MBpkLggj/AHwHBw8bAAQHZQliA3gNnQK0BT4AqwvWDdsGmwL8C5IF5glQAekDXAy2CaAHVw2YA2QKjAIzDeUIKwQRCssL7gCADm8K0g1VCM8C0wrIDpQIowI+DK8KxgiUAMYGoA70A7QKfAETBoYDkg2kASIGtwMADLgGJgrhAGEDBQ5wAlIFYgy8AocLswRxAT4Lrgh2D/0GWQr9AykJ2QACDdIIAgAPD5QGogi5BM8AdA44Bb8I8gATD6ULYQAhDlIHfw2jA6kHZwLkC3oGqA+KAGYHQApjBOcPeAV+A68NMArfAQ8J1Qz7BIYP1AuDB0ILTA4tCRoNqwITCFIPlQkHB74KXQ86CQAGNwgaDr8MZQZFBNoJAAJ1DLcHXg/bBEgGGQ5ZBH8LjQ1IAnsP2QZ/ChgCcgvHBrQE3gd1A/UKAQL3BMQIfw+7BTMBuAnzBKUMkQNADswAOQcDAsgL9QevBLcPFgMhCAEAlgk9ApYE1gCDCkoFSAATDjEErAt3BWwAxQy6A3YBgQ6HAysKVgL1Dn4ANw1EBRsOHQHIAqEJsAqvAdcH5gKXCQcGpAz8CPAD9gynDw4DoAx3CeAF3Q+sBn8MCAAXCwANOQSbDdMH+QFtCY8FEwv+DJ0Jlw4pBocB9wunBewNGgudBkcN+AivDvkGagOtCLkKZgbPAVINEQnNBPIHewogDI4AFQdJBVMInQtWB0YD0Qp5BhoMuA6XA2wMuA83BQkLcwALA1MLXwHiBbAH6wm+AbMNDQE3CvMCdw5/CVgD9wY/CsAC+Q6SC9AGfQ3hAjMIiAQ1AMoKag1iCVoHywEGBDYPBwOqBVIMCwLkD54MgQGUDkIIPQO+D0YCsQ2nBhUF+wjjD9QKtgN/DtYB2gi9DzMETQhiAU0HwQUmCTUBag46B5kEvg5BCM8NGABOBcEOdAg7BB4MxAeMBd4BIggwD6AA+QXxCH0BAQSaD04BEQYdDyQDpgf7A+YAYw6OCpIMtQeHAGYK6AdEBMAJvgV5B60E4wvpCckF9wrvAOQOqAJkDfYBiwz1ALUJrgXiDCIAOQobBakNrQuBAg4NvgNnCFgNBAqPBqQCBwxpCoIDSQtvAuUGNQ+LAHAL2Q06DK4E8gpRDuQMKQWiCowIBgzyCdIM3wjXC+sOxQYmBcQCyQjfBOkL2g5ZAbANsguNACEPsAKLDT0ATwd8DOkI3QPRB/gJlwReBgQIiQ0RBFcLrAdeAnEOXQmhAHUKBQ9NBrUK7wH1D7EAZwlXBFkPDQfUDLEFVg0jCQkF6gmgA1kGbwFbCOoCNwcqALMOhgIBB5EADAWjAdUFggI0C6QJqw8pAcgNawaDA0QJLwXVAlEI0gpGCbkG/AMZD/gCRwXtDFsLBgCIDsMLaQKHD8gG+QLwDk8M+wVBA/wGXwTdBysAPAxgBW0HrAwfDv4F4gECCZwAPQqaAVkDnA5EApQHbw+LCZsMSATFC74J7wVsDWoEFA50CloPSQ3OB1EA8wy9Ay0H5QkPAkwLhAeKD6gG+AxUBCgBSwvvDVIIgQrEAY8PxgU8B0oD0Ag0BWAKkAB8CeME/ADoCH4LzQ+oDKgJzgLtDd4DNAGxCDYDdAvHB3INtgSXDwkI0wttBvsKBQ1DAKEFAQ6xAf8PAgh2A+AKZgj6AWcHjwNhCXoEWw5rCJwFVgwrD6cEhw0tAKcK0AFSDvcFVQxlAn0FtQAhDPsGmQl6AYANwgo0D5wBEw2eB/cN6QoZB44N6gE+BQwBtg4CBlkIqAt3BswK7wRJAJoOCgMmDLoGIATQDbcArwiMBCcKUAPuBoYKQAVeAQMNwQCND/oL+AVRCw4BEAxVBuEBtgqiAPECCQnyBYcMNQSbCTQDwQjED8YHxAnYDosElQJQDssDNgirAJAGVQTcC7YFqQOlAVwPMAQ1CJQK0QZkAxULyAEnD1cCOg1qDxkKQQY/CU0B1QpQAqcJvAXQDyQCVQ5DDM4IfALBDXoLRwZyCfQE+wKrDkMIoALpDwkKTgPRDrwLkwdLDrYBUAhAD0QHuwuNAcgEaA2LA4gGCw2kCLML/QT0CbsMKA5qCXYCnQ5dCBIMJAbiCbsCZQxXDioJhA2xBMcJxwWAAwcI1wG3CzoFkA16CAgPtQxEA4YLkgbjB+AAOg9hBFkH7gi4A1MOLwchCg0APA1UBSwH2QzTBJcIbAb6A3IK6AsFA1EFlwArDoIKCwcWAB4L+AFBCuUAkAfsDxMCzgV8A/4HNwsyAEUKDQMMDXcA7w6CBIUBpQVPAOUHLQ6oAHoJgQxNBGsHyQ+vA14AcQYLBQMBXAieDaEDBAv6BfALUAB3D00CWAybAccNmARMCQgLcgEfCckAsg0vArYPfwDkBvQNNQquDBwG6wPcDjQMtgh8D4UFqA0tA2gG8wouDAkBFg/nBigF0w9pBw4JTAULCyQHeAi0C98M1QO4CvgLlwZ+DggB6gw+AoUKqgf+C1UJ0g5KCnUBAwVmCRkCIw3ZCXMFswpwCN8Fcwu7Bx0DEA8UBFYOogvmBZgJmgwuBU8JHARqAXIIqQJTCaEBMAXnAjgHDwQIDKIJOQCyDsAIhgRmDRsC0wwZBB8BMg40AnANcQOFD/MJywI0B9oPqAinAiMFWgi3CQsGuw5/BBwO3AEFBAgGhAwVD40HLw7XA9oHJQPADq4AJQSbDxUCOAz/Bf4GVQLAB2sDBQsWCK0B2w7oDGwH7w9aCzgN6QdeCq8Mgg5FASMIQQ7ABDEH6AIyCisGhAgHC64JfQbHC78HwQnfAE4G0gE3DlYFfwE=';
  var NOISE = null, FALL = null;
  function noise() {
    if (NOISE) return NOISE;
    var bin = atob(NOISE_B64), t = new Float32Array(4096);
    for (var i = 0; i < 4096; i++) t[i] = ((bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) + 0.5) / 4096;
    return (NOISE = t);
  }
  function erf(x) {                       // Abramowitz e Stegun 7.1.26 (erro abaixo de 2e-7)
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  function fall(u) { return u >= 1 ? 0 : u <= 0 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * u); }   // a queda das luzes: em curva, lisa nas pontas
  function fallTable() {                  // a mesma queda em tabela, pelo quadrado da distância (sem raiz e sem cosseno por pixel)
    if (FALL) return FALL;
    FALL = new Float64Array(4098);
    for (var i = 0; i <= 4097; i++) FALL[i] = fall(Math.sqrt(Math.min(1, i / 4096)));
    return FALL;
  }
  function ease(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }                   // a passagem entre os tons
  // a passagem entre duas seções é uma curva só, dividida na borda: cada seção pinta a metade dela (m = 1, a metade de
  // cima, que começa parada; m = 2, a de baixo, que termina parada), e as duas se encontram na cor do meio com a mesma
  // inclinação. Assim a metade de uma seção não depende da altura da outra.
  function curve(t, m) {
    t = t <= 0 ? 0 : t >= 1 ? 1 : t;
    return m === 1 ? 2 * ease(t / 2) : m === 2 ? 2 * ease(0.5 + t / 2) - 1 : ease(t);
  }

  // Um trabalho: uma imagem de w x h pixels que mostra o trecho da cena que começa em (x0, y0) pontos, com k pixels por
  // ponto. ox e oy dizem onde a imagem cai na grade da máscara (em pixels), para os pedaços vizinhos emendarem. A cena: um
  // tom liso (base), os tons (tone: pares [y, r, g, b]) ou um céu (sky); por cima, as luzes (glows: elipses com a cor, a
  // força e a queda) e as sombras (shades: um retângulo desfocado, como uma box-shadow). Sai em RGB (ou RGBA, para o céu).
  function paint(job) {
    var w = job.w, h = job.h, k = job.k, th = noise(), F = fallTable(), x, y, i, j;
    var tone = job.tone, ti = 0, base = job.base, sky = job.sky;
    var glows = job.glows || [], shades = job.shades || [];
    var ch = job.kind === 'rgba' ? 4 : 3, out = new Uint8Array(w * h * ch);
    var R = new Float64Array(w), G = new Float64Array(w), B = new Float64Array(w), X = new Float64Array(w);
    for (x = 0; x < w; x++) X[x] = job.x0 + (x + 0.5) / k;
    // as sombras: o desfoque de um retângulo é o produto de dois desfoques de uma faixa (um na largura, outro na altura)
    var sh = shades.map(function (s) {
      var q = 1 / (s.s * Math.SQRT2), gx = new Float64Array(w), a = -1, b = -1;
      for (x = 0; x < w; x++) { gx[x] = 0.5 * (erf((X[x] - s.x0) * q) - erf((X[x] - s.x1) * q)); if (gx[x] > 1e-4) { if (a < 0) a = x; b = x + 1; } }
      return { gx: gx, q: q, y0: s.y0, y1: s.y1, a: s.a, c: s.c, from: a, to: b };
    });
    var gl = glows.map(function (g) {
      var e = g.end || 1;
      return { cx: g.cx, cy: g.cy, ix: 1 / (g.rx * e), iy: 1 / (g.ry * e), a: g.a, c: g.c,
        from: Math.max(0, Math.floor((g.cx - g.rx * e - job.x0) * k)), to: Math.min(w, Math.ceil((g.cx + g.rx * e - job.x0) * k)),
        top: g.cy - g.ry * e, bottom: g.cy + g.ry * e };
    });
    for (y = 0; y < h; y++) {
      var Y = job.y0 + (y + 0.5) / k, r0, g0, b0;
      if (tone) {
        while (ti < tone.length - 2 && Y > tone[ti + 1][0]) ti++;
        var A = tone[ti], N = tone[Math.min(ti + 1, tone.length - 1)];
        var t = N[0] > A[0] ? curve((Y - A[0]) / (N[0] - A[0]), A[4]) : (Y > A[0] ? 1 : 0);
        r0 = A[1] + (N[1] - A[1]) * t; g0 = A[2] + (N[2] - A[2]) * t; b0 = A[3] + (N[3] - A[3]) * t;
        for (x = 0; x < w; x++) { R[x] = r0; G[x] = g0; B[x] = b0; }
      } else if (sky) {                    // o céu do estúdio: uma luz no alto que se apaga em curva até a borda
        var dy0 = Y - sky.cy;
        for (x = 0; x < w; x++) {
          var dx0 = X[x] - sky.cx, f0 = fall(Math.sqrt(dx0 * dx0 + dy0 * dy0) / sky.r);
          R[x] = sky.c1[0] + (sky.c0[0] - sky.c1[0]) * f0; G[x] = sky.c1[1] + (sky.c0[1] - sky.c1[1]) * f0; B[x] = sky.c1[2] + (sky.c0[2] - sky.c1[2]) * f0;
        }
      } else { for (x = 0; x < w; x++) { R[x] = base[0]; G[x] = base[1]; B[x] = base[2]; } }
      for (j = 0; j < gl.length; j++) {    // cada luz: a cor dela por cima, com a força que cai do centro para fora
        var L = gl[j];
        if (Y < L.top || Y > L.bottom) continue;
        var dy = (Y - L.cy) * L.iy, dy2 = dy * dy, c = L.c;
        for (x = L.from; x < L.to; x++) {
          var dx = (X[x] - L.cx) * L.ix, u2 = dx * dx + dy2;
          if (u2 >= 1) continue;
          var s4 = u2 * 4096, i0 = s4 | 0, f = L.a * (F[i0] + (F[i0 + 1] - F[i0]) * (s4 - i0));
          R[x] += (c[0] - R[x]) * f; G[x] += (c[1] - G[x]) * f; B[x] += (c[2] - B[x]) * f;
        }
      }
      for (j = 0; j < sh.length; j++) {    // cada sombra: a cor dela (quase preta) por cima, com a força do desfoque
        var Sd = sh[j];
        if (Sd.from < 0) continue;
        var gy = 0.5 * (erf((Y - Sd.y0) * Sd.q) - erf((Y - Sd.y1) * Sd.q));
        if (gy < 1e-4) continue;
        var ay = Sd.a * gy, sc = Sd.c;
        for (x = Sd.from; x < Sd.to; x++) {
          var s = ay * Sd.gx[x];
          R[x] += (sc[0] - R[x]) * s; G[x] += (sc[1] - G[x]) * s; B[x] += (sc[2] - B[x]) * s;
        }
      }
      // o arredondamento, uma vez só: a máscara decide se o pixel vai para o tom de cima ou o de baixo
      var my = ((job.oy + y) & 63) << 6, mx = job.ox & 63, v;
      for (x = 0, i = y * w * ch; x < w; x++) {
        var tt = th[my | ((mx + x) & 63)];
        v = Math.floor(R[x] + tt); out[i++] = v < 0 ? 0 : v > 255 ? 255 : v;
        v = Math.floor(G[x] + tt); out[i++] = v < 0 ? 0 : v > 255 ? 255 : v;
        v = Math.floor(B[x] + tt); out[i++] = v < 0 ? 0 : v > 255 ? 255 : v;
        if (ch === 4) out[i++] = 255;
      }
    }
    return out;
  }

  // ----- a imagem: PNG com paleta (sem perda; cada pedaço tem poucas cores), ou BMP onde o navegador não comprime -----
  var CRC = null;
  function crc32(u) {
    if (!CRC) { CRC = new Int32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var b = 0; b < 8; b++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } }
    var r = -1;
    for (var i = 0; i < u.length; i++) r = CRC[(r ^ u[i]) & 255] ^ (r >>> 8);
    return (r ^ -1) >>> 0;
  }
  function chunk(type, data) {
    var out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (var i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }
  function png(w, h, rgb) {
    // a paleta, se couber em 256 cores (quase sempre: cada pixel é o tom de cima ou o de baixo)
    var keys = new Int32Array(1024).fill(-1), slot = new Uint8Array(1024), pal = [], idx = new Uint8Array(h * (w + 1)), ok = true;
    for (var y = 0, p = 0; y < h && ok; y++) {
      var o = y * (w + 1) + 1;
      for (var x = 0; x < w; x++, p += 3) {
        var key = (rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2], hs = Math.imul(key, 0x9e3779b1) >>> 22;
        while (keys[hs] !== -1 && keys[hs] !== key) hs = (hs + 1) & 1023;
        if (keys[hs] === -1) { if (pal.length === 256) { ok = false; break; } keys[hs] = key; slot[hs] = pal.length; pal.push(key); }
        idx[o++] = slot[hs];
      }
    }
    var head = new Uint8Array(13), dv = new DataView(head.buffer), raw, plte = null, i;
    dv.setUint32(0, w); dv.setUint32(4, h); head[8] = 8;
    if (ok) {
      head[9] = 3; raw = idx; plte = new Uint8Array(pal.length * 3);
      for (i = 0; i < pal.length; i++) { plte[i * 3] = pal[i] >> 16; plte[i * 3 + 1] = (pal[i] >> 8) & 255; plte[i * 3 + 2] = pal[i] & 255; }
    } else {
      head[9] = 2; raw = new Uint8Array(h * (3 * w + 1));
      for (y = 0; y < h; y++) raw.set(rgb.subarray(y * 3 * w, (y + 1) * 3 * w), y * (3 * w + 1) + 1);
    }
    var z = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Response(z).arrayBuffer().then(function (data) {
      var parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head)];
      if (plte) parts.push(chunk('PLTE', plte));
      parts.push(chunk('IDAT', new Uint8Array(data)), chunk('IEND', new Uint8Array(0)));
      return new Blob(parts, { type: 'image/png' });
    });
  }
  function bmp(w, h, rgb) {                // 24 bits, de cima para baixo (altura negativa), sem compressão
    var stride = (w * 3 + 3) & ~3, out = new Uint8Array(54 + stride * h), dv = new DataView(out.buffer);
    out[0] = 0x42; out[1] = 0x4d; dv.setUint32(2, out.length, true); dv.setUint32(10, 54, true); dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true); dv.setInt32(22, -h, true); dv.setUint16(26, 1, true); dv.setUint16(28, 24, true);
    dv.setUint32(34, stride * h, true); dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true);
    for (var y = 0, p = 0; y < h; y++) for (var x = 0, i = 54 + y * stride; x < w; x++, p += 3) { out[i++] = rgb[p + 2]; out[i++] = rgb[p + 1]; out[i++] = rgb[p]; }
    return new Blob([out], { type: 'image/bmp' });
  }
  function make(job) {
    var px = paint(job);
    if (job.kind === 'rgba') return Promise.resolve({ w: job.w, h: job.h, buf: px.buffer });
    if (typeof CompressionStream === 'undefined') return Promise.resolve({ blob: bmp(job.w, job.h, px) });
    return png(job.w, job.h, px).then(function (b) { return { blob: b }; });
  }

  // ---------- No Worker: só a conta, um trabalho por vez, os mais urgentes primeiro ----------
  if (typeof document === 'undefined') {
    var queue = [], working = false;
    var next = function () {
      if (working || !queue.length) return;
      queue.sort(function (a, b) { return a.pri - b.pri || a.id - b.id; });
      var m = queue.shift(), p;
      working = true;
      try { p = make(m.job); } catch (err) { p = Promise.reject(err); }
      p.then(function (r) { self.postMessage({ id: m.id, res: r }, r.buf ? [r.buf] : []); },
        function (err) { self.postMessage({ id: m.id, err: String((err && err.message) || err) }); })
        .then(function () { working = false; setTimeout(next, 0); });
    };
    self.onmessage = function (e) {
      var m = e.data;
      if (m.cancel) { queue = queue.filter(function (q) { return m.cancel.indexOf(q.id) < 0; }); return; }
      queue.push(m);
      next();
    };
    return;
  }

  // ---------- Na página ----------
  var root = document.documentElement, body = document.body, me = document.currentScript && document.currentScript.src;
  // a conta roda em até 3 Workers ao mesmo tempo (um por núcleo livre do processador); sem Worker, aqui mesmo
  var workers = [], seq = 0, waiting = {}, local = [], localBusy = false;
  function deliver(id, res) { var w = waiting[id]; delete waiting[id]; if (w) w.cb(res); }
  function pumpLocal() {                 // sem Worker: a mesma conta aqui, um trabalho por vez (mais lento, mas igual)
    if (localBusy || !local.length) return;
    local.sort(function (a, b) { return a.pri - b.pri || a.id - b.id; });
    var m = local.shift();
    localBusy = true;
    Promise.resolve().then(function () { return make(m.job); })
      .then(function (r) { deliver(m.id, r); }, function () { deliver(m.id, null); })
      .then(function () { localBusy = false; setTimeout(pumpLocal, 0); });
  }
  function send(id) {                    // para o Worker com menos trabalho na fila
    var w = waiting[id], best = null;
    workers.forEach(function (wk) { if (!best || wk.load < best.load) best = wk; });
    if (!best) { w.wk = null; local.push({ id: id, job: w.job, pri: w.pri }); setTimeout(pumpLocal, 0); return; }
    w.wk = best; best.load++;
    best.w.postMessage({ id: id, job: w.job, pri: w.pri });
  }
  (function () {
    var n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    for (var i = 0; i < n && me; i++) {
      try {
        var wk = { w: new Worker(me), load: 0 };
        wk.w.onmessage = function (e) { var w = waiting[e.data.id]; if (w && w.wk) w.wk.load--; deliver(e.data.id, e.data.err ? null : e.data.res); };
        wk.w.onerror = (function (wk) {      // este Worker não abriu: o que estava com ele vai para os outros (ou fica aqui)
          return function (e) {
            if (e && e.preventDefault) e.preventDefault();
            workers = workers.filter(function (x) { return x !== wk; });
            Object.keys(waiting).forEach(function (id) { if (waiting[id].wk === wk) send(+id); });
          };
        })(wk);
        workers.push(wk);
      } catch (err) { break; }
    }
  })();
  function post(job, pri, cb) {
    var id = ++seq;
    waiting[id] = { job: job, pri: pri, cb: cb, wk: null };
    send(id);
    return id;
  }
  function cancel(id) {
    var w = waiting[id];
    if (!w) return;
    delete waiting[id];
    if (w.wk) { w.wk.load--; w.wk.w.postMessage({ cancel: [id] }); }
    else local = local.filter(function (m) { return m.id !== id; });
  }

  // ----- os pedaços prontos, pela receita de cada um (a mesma receita dá a mesma imagem) -----
  var cache = {}, SPARE = 24e6;          // até 24 MB de pedaços fora de uso, para voltar na hora (uma aba que fecha de novo)
  function need(key, job, pri) {
    var e = cache[key];
    if (e) { e.t = Date.now(); return; }
    e = cache[key] = { st: 'wait', t: Date.now(), bytes: 0, url: null, img: null };
    e.id = post(job, pri, function (res) {
      if (cache[key] !== e) return;      // ninguém quer mais
      if (!res || !res.blob) { e.st = 'ok'; settle(); return; }      // deu errado: o pedaço fica de fora
      e.url = URL.createObjectURL(res.blob); e.bytes = res.blob.size;
      var im = new Image(); e.img = im; im.src = e.url;
      (im.decode ? im.decode() : Promise.resolve()).catch(function () {}).then(function () {
        if (cache[key] !== e) return;
        e.st = 'ok'; settle();
      });
    });
  }

  // ----- quem recebe os pedaços: cada seção, a página (por baixo de tudo) e os quadros com luz dentro -----
  var targets = [];
  function target(kind, el) {
    for (var i = 0; i < targets.length; i++) if (targets[i].el === el) return targets[i];
    var t = { kind: kind, el: el, want: null, sig: '', keys: [], on: false };
    targets.push(t);
    return t;
  }
  function layersCss(w) {
    var L = w.layers.filter(function (l) { return cache[l.key].url; });
    return {
      img: L.map(function (l) { return 'url("' + cache[l.key].url + '")'; }).join(', ') || 'none',
      pos: L.map(function (l) { return l.pos; }).join(', ') || '0 0',
      size: L.map(function (l) { return l.size; }).join(', ') || 'auto',
      rep: L.map(function (l) { return l.rep; }).join(', ') || 'no-repeat'
    };
  }
  function later(el, cls) { requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add(cls); }); }); }
  function apply(t, w) {
    var c = layersCss(w), s = t.el.style;
    if (t.kind === 'sec') {
      // no ::before, os tons (a passagem nas bordas e o tom liso do meio); no ::after, as luzes e as sombras, por cima
      var z = layersCss({ layers: w.zones }), b = layersCss({ layers: w.bands || [] });
      s.setProperty('--bd-zimg', z.img); s.setProperty('--bd-zpos', z.pos); s.setProperty('--bd-zsize', z.size); s.setProperty('--bd-zrep', z.rep);
      s.setProperty('--bd-img', b.img); s.setProperty('--bd-pos', b.pos); s.setProperty('--bd-size', b.size); s.setProperty('--bd-rep', b.rep);
      s.setProperty('--bd-bg', w.bg);
      if (!t.on) { t.on = true; t.el.classList.add('bd'); later(t.el, 'bd-on'); }          // na primeira vez, entram devagar
      if (!t.lit && w.bands && w.bands.length) { t.lit = true; later(t.el, 'bd-lit'); }
    } else {
      s.backgroundImage = c.img; s.backgroundPosition = c.pos; s.backgroundSize = c.size; s.backgroundRepeat = c.rep;
      if (t.kind === 'body') root.classList.add('has-backdrop'); else t.el.classList.add('is-painted');
    }
  }
  // troca o que estiver pronto: uma seção só troca quando todos os pedaços novos dela estão prontos (assim os tons, as
  // luzes e as sombras dela sempre combinam). Na primeira vez, os tons entram antes: são pequenos e ficam prontos logo, e
  // com eles as bordas entre as seções já batem; as luzes e as sombras entram por cima quando chegam.
  function ok(list) { for (var i = 0; i < list.length; i++) { var e = cache[list[i].key]; if (!e || e.st !== 'ok') return false; } return true; }
  function settle() {
    // na primeira vez, os tons de todas as seções entram juntos (as bordas entre elas batem desde o começo)
    var secs = targets.filter(function (t) { return t.kind === 'sec' && t.want; });
    if (secs.some(function (t) { return !t.on; }) && secs.every(function (t) { return t.on || ok(t.want.zones); })) {
      secs.forEach(function (t) {
        if (t.on || ok(t.want.layers)) return;
        apply(t, { zones: t.want.zones, bands: [], bg: t.want.bg, layers: t.want.zones });
        t.sig = 'tons'; t.keys = t.want.zones.map(function (l) { return l.key; });
      });
    }
    targets.forEach(function (t) {
      var w = t.want;
      if (!w || w.sig === t.sig || (t.kind === 'sec' && !t.on && !ok(w.zones))) return;
      if (t.kind === 'sec' && !t.on && secs.some(function (o) { return !o.on && !ok(o.want.zones); })) return;
      if (ok(w.layers)) { apply(t, w); t.sig = w.sig; t.keys = w.layers.map(function (l) { return l.key; }); }
    });
    clearTimeout(tidyTimer); tidyTimer = setTimeout(tidy, 400);
  }
  // solta o que não está em uso (os mais antigos primeiro, passando da reserva)
  var tidyTimer = 0;
  function tidy() {
    var used = {}, wanted = {}, spare = [], total = 0;
    targets.forEach(function (t) {
      t.keys.forEach(function (k) { used[k] = 1; });
      if (t.want) t.want.layers.forEach(function (l) { wanted[l.key] = 1; });
    });
    Object.keys(cache).forEach(function (k) {
      var e = cache[k];
      if (used[k]) { e.img = null; e.t = Date.now(); return; }
      if (wanted[k]) return;
      if (e.st === 'wait') { cancel(e.id); delete cache[k]; return; }
      spare.push(k);
    });
    spare.sort(function (a, b) { return cache[b].t - cache[a].t; });
    spare.forEach(function (k) {
      var e = cache[k];
      e.img = null; total += e.bytes;
      if (total > SPARE) { if (e.url) URL.revokeObjectURL(e.url); delete cache[k]; }
    });
  }

  // ----- leitura do CSS -----
  var warned = {};
  function warn(what, v) { if (warned[what + v]) return; warned[what + v] = 1; if (window.console) console.warn('backdrop.js: ' + what + ' inválido: "' + v + '"'); }
  function hex(v) {
    var m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(v || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function color(v) {                    // a cor de fundo calculada pelo navegador: rgb(r, g, b)
    var m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(v || '');
    return m ? [+m[1], +m[2], +m[3]] : [20, 20, 20];
  }
  function same(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function len(v, size) { v = String(v).trim(); return /%$/.test(v) ? parseFloat(v) / 100 * size : parseFloat(v); }
  // "60% 540px at 50% 390px / 110 150 255 / 0.075": a elipse (raios e centro, em % da caixa ou em px), a cor e a força
  function glowsOf(el, bw, bh, ox, oy) {
    var cs = getComputedStyle(el), out = [];
    for (var n = 1; n <= 3; n++) {
      var v = cs.getPropertyValue('--glow-' + n).trim();
      if (!v) continue;
      var p = v.split('/'), g = p[0].trim().split(/\s+/), c = String(p[1] || '').trim().split(/\s+/).map(Number), a = parseFloat(p[2]);
      var o = g.length >= 5 && g[2] === 'at' ? { rx: len(g[0], bw), ry: len(g[1], bh), cx: ox + len(g[3], bw), cy: oy + len(g[4], bh), c: c.slice(0, 3), a: a, end: 0.7 } : null;
      if (!o || c.length < 3 || !(a >= 0 && a <= 1) || !(o.rx > 0 && o.ry > 0) ||
          [o.cx, o.cy].concat(o.c).some(function (x) { return !isFinite(x); })) { warn('--glow-' + n, v); continue; }
      out.push(o);
    }
    return out;
  }
  function pageBox(el) { var r = el.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height }; }
  function tone(name) {
    var v = getComputedStyle(root).getPropertyValue('--tone-' + name), c = hex(v);
    if (!c) { if (v.trim()) warn('--tone-' + name, v.trim()); c = hex(getComputedStyle(root).getPropertyValue('--bg')) || [20, 20, 20]; }
    return c;
  }
  // os números da receita com 3 casas (a mesma posição não pode virar outra receita por um resto de conta)
  function tidyNums(o) {
    if (typeof o === 'number') return Math.round(o * 1000) / 1000;
    if (Array.isArray(o)) return o.map(tidyNums);
    if (o && typeof o === 'object') { var r = {}; for (var k in o) r[k] = tidyNums(o[k]); return r; }
    return o;
  }

  // ----- o fundo das seções -----
  var SECTIONS = ['top', 'work', 'skills', 'wsx', 'about', 'store', 'contact'];   // na ordem da página (id = o nome do tom)
  var SHADED = '.studio, .wsx__board, .about__photo';
  var INSIDE = ['.window', '.wsx__board'];                         // quadros com as luzes pintadas dentro deles
  var TILE = 64;                          // a largura da tira dos tons, em pixels: uma volta da máscara (repetida na largura)
  var MAXROWS = 4096;                     // a tira da página vai em pedaços (imagem alta demais a placa de vídeo encolhe)
  var stops = [], bar = document.querySelector('.bar'), themeMeta = document.querySelector('meta[name="theme-color"]'), themeNow = '', barNow = '';
  // pixels de imagem por ponto da página: os da tela, até 2 (acima disso o pixel já é miúdo demais para ver a diferença)
  function scale() { return Math.min(window.devicePixelRatio || 1, 2); }

  // os tons, de [y, r, g, b] em [y, r, g, b], com y contado a partir de ay; só o trecho de y0 a y1 (e as pontas lisas
  // viram a própria borda do trecho: onde um tom liso começa não muda a pintura)
  function toneFor(ay, y0, y1) {
    var s = stops, i0 = 0, i1 = s.length - 1, out = [], i;
    while (i0 < i1 && s[i0 + 1][0] - ay <= y0) i0++;
    while (i1 > i0 && s[i1 - 1][0] - ay >= y1) i1--;
    for (i = i0; i <= i1; i++) out.push([s[i][0] - ay, s[i][1], s[i][2], s[i][3], s[i][4]]);
    var n = out.length - 1;
    out[n][4] = 0;                       // a curva que sai da última não entra no trecho
    if (n === 0) { out[0][0] = y0; return out; }
    if (same(out[0].slice(1), out[1].slice(1))) { out[0][0] = y0; out[0][4] = 0; }
    if (same(out[n - 1].slice(1), out[n].slice(1))) { out[n][0] = y1; out[n - 1][4] = 0; }
    return out;
  }
  // uma luz em fatias: a largura de cada fatia segue a elipse (os cantos da caixa não têm luz)
  function glowRects(g) {
    var R = g.ry * g.end, Rx = g.rx * g.end, out = [], N = 8;
    for (var j = 0; j < N; j++) {
      var a = g.cy - R + 2 * R * j / N, b = a + 2 * R / N;
      var d = a <= g.cy && b >= g.cy ? 0 : Math.min(Math.abs(a - g.cy), Math.abs(b - g.cy)), hw = Rx * Math.sqrt(Math.max(0, 1 - (d / R) * (d / R)));
      out.push({ x0: g.cx - hw, x1: g.cx + hw, y0: a, y1: b });
    }
    return out;
  }
  // junta os retângulos em faixas que não se sobrepõem (uma faixa pega a largura de tudo que passa por ela)
  function bands(rects) {
    var ys = [], out = [], i;
    rects.forEach(function (r) { ys.push(r.y0, r.y1); });
    ys.sort(function (a, b) { return a - b; });
    for (i = 0; i + 1 < ys.length; i++) {
      var a = ys[i], b = ys[i + 1];
      if (b - a < 0.01) continue;
      var x0 = Infinity, x1 = -Infinity;
      rects.forEach(function (r) { if (r.y0 <= a && r.y1 >= b) { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); } });
      if (!(x1 > x0)) continue;
      var last = out[out.length - 1];
      if (last && Math.abs(last.y1 - a) < 0.01) {     // emenda com a de cima se o retângulo junto não cresce muito
        var hx0 = Math.min(last.x0, x0), hx1 = Math.max(last.x1, x1);
        if ((hx1 - hx0) * (b - last.y0) <= 1.15 * ((last.x1 - last.x0) * (last.y1 - last.y0) + (x1 - x0) * (b - a))) { last.x0 = hx0; last.x1 = hx1; last.y1 = b; continue; }
      }
      out.push({ x0: x0, x1: x1, y0: a, y1: b });
    }
    return out;
  }
  // um pedaço do fundo de uma seção, preso à borda de cima ('top') ou à de baixo ('bottom') dela
  function piece(r, S, anchor, k, W, tile, feats) {
    var ay = anchor === 'top' ? S.y : S.y1, hk = Math.ceil(S.h * k - 1e-6);
    var Y0 = Math.floor((r.y0 - ay) * k + 1e-6), Y1 = Math.ceil((r.y1 - ay) * k - 1e-6), X0 = 0, X1 = TILE;
    if (!tile) {                         // um pixel a mais em volta: o vizinho embaixo tem a mesma pintura ali
      Y0 -= 1; Y1 += 1;
      X0 = Math.max(0, Math.floor(r.x0 * k) - 1); X1 = Math.min(Math.ceil(W * k), Math.ceil(r.x1 * k) + 1);
    }
    if (anchor === 'top') { Y0 = Math.max(0, Y0); Y1 = Math.min(hk, Y1); } else { Y0 = Math.max(-hk, Y0); Y1 = Math.min(0, Y1); }
    if (X1 - X0 < 1 || Y1 - Y0 < 1) return null;
    var x0 = X0 / k, x1 = X1 / k, y0 = Y0 / k, y1 = Y1 / k;
    var job = { kind: 'img', w: X1 - X0, h: Y1 - Y0, k: k, x0: x0, y0: y0, ox: X0, oy: Y0, tone: tidyNums(toneFor(ay, y0, y1)) };
    if (!tile) {
      var py0 = ay + y0, py1 = ay + y1, gl = [], sh = [];
      feats.forEach(function (f) {
        if (f.x1 <= x0 || f.x0 >= x1 || f.y1 <= py0 || f.y0 >= py1) return;
        if (f.g) gl.push({ cx: f.g.cx, cy: f.g.cy - ay, rx: f.g.rx, ry: f.g.ry, end: f.g.end, a: f.g.a, c: f.g.c });
        else sh.push({ x0: f.sd.x0, x1: f.sd.x1, y0: f.sd.y0 - ay, y1: f.sd.y1 - ay, s: f.sd.s, a: f.sd.a, c: f.sd.c });
      });
      job.glows = tidyNums(gl); job.shades = tidyNums(sh);
    }
    return { key: JSON.stringify(job), job: job, rep: tile ? 'repeat-x' : 'no-repeat',
      pos: anchor === 'top' ? x0 + 'px ' + y0 + 'px' : 'left ' + x0 + 'px bottom ' + (-y1) + 'px',
      size: (X1 - X0) / k + 'px ' + (Y1 - Y0) / k + 'px' };
  }
  // os pedaços de uma seção: as luzes e as sombras que passam por ela (em faixas), e as passagens de tom nas bordas
  function sectionPieces(S, i, feats, k, W) {
    var items = [], zones = [], ext = {}, out = [];
    feats.forEach(function (f) {
      if (f.y1 <= S.y || f.y0 >= S.y1) return;
      // presa à borda mais perto do quadro ou da luz; a de uma seção vizinha, à borda que encosta nela
      var a = f.own === i ? (f.cy - S.y <= S.y1 - f.cy ? 'top' : 'bottom') : (f.own < i ? 'top' : 'bottom');
      items.push({ f: f, a: a });
    });
    if (S.zTop) zones.push({ y0: S.y, y1: S.y + S.zTop, x0: 0, x1: W, a: 'top' });
    if (S.zBot) zones.push({ y0: S.y1 - S.zBot, y1: S.y1, x0: 0, x1: W, a: 'bottom' });
    function grow(a, y0, y1) {
      y0 = Math.max(S.y, y0); y1 = Math.min(S.y1, y1);
      var e = ext[a];
      ext[a] = e ? { y0: Math.min(e.y0, y0), y1: Math.max(e.y1, y1) } : { y0: y0, y1: y1 };
    }
    items.forEach(function (it) { grow(it.a, it.f.y0, it.f.y1); });
    zones.forEach(function (z) { grow(z.a, z.y0, z.y1); });
    // se o que fica preso em cima encosta no que fica preso embaixo (uma seção baixa), tudo fica preso em cima
    if (ext.top && ext.bottom && ext.top.y1 >= ext.bottom.y0 - 2) {
      items.forEach(function (it) { it.a = 'top'; }); zones.forEach(function (z) { z.a = 'top'; });
    }
    ['top', 'bottom'].forEach(function (a) {
      var rects = [];
      items.forEach(function (it) {
        if (it.a !== a) return;
        it.f.rects.forEach(function (r) {
          var c = { x0: Math.max(0, r.x0), x1: Math.min(W, r.x1), y0: Math.max(S.y, r.y0), y1: Math.min(S.y1, r.y1) };
          if (c.x1 > c.x0 && c.y1 > c.y0) rects.push(c);
        });
      });
      bands(rects).forEach(function (b) {   // uma faixa alta vai em pedaços (imagem alta demais a placa de vídeo encolhe)
        var step = (MAXROWS - 8) / k;
        for (var y = b.y0; y < b.y1; y += step) {
          var p = piece({ x0: b.x0, x1: b.x1, y0: y, y1: Math.min(b.y1, y + step) }, S, a, k, W, false, feats);
          if (p) out.push(p);
        }
      });
    });
    zones.forEach(function (z) { var p = piece(z, S, z.a, k, W, true, feats); if (p) { p.zone = true; out.push(p); } });
    return out;
  }
  // a ordem dos trabalhos: o que está na tela primeiro, depois o mais perto dela
  function urgency(y0, y1) { var v0 = window.scrollY, v1 = v0 + window.innerHeight; return y1 < v0 ? v0 - y1 : y0 > v1 ? y0 - v1 : 0; }

  var ready = false;
  function plan() {
    if (!ready || document.querySelector('.lightbox[open]')) return;   // com o visualizador aberto, a página de trás espera
    try { planNow(); } catch (err) { if (window.console) console.warn('backdrop.js', err); }
  }
  function planNow() {
    var k = scale(), W = root.clientWidth, H = Math.max(root.scrollHeight, root.clientHeight), BG = tone('top'), i;
    var secs = [];
    SECTIONS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var b = pageBox(el);
      if (b.h > 0) secs.push({ el: el, id: id, x: b.x, y: b.y, w: b.w, h: b.h, y1: b.y + b.h, c: tone(id), zTop: 0, zBot: 0 });
    });
    if (!secs.length) return;
    // os tons: o de cada seção vale no meio dela e passa para o da próxima em volta da borda entre as duas
    // (cada metade da passagem cabe na metade da própria seção, para uma seção baixa não emendar as duas passagens dela)
    var ZONE = Math.max(240, Math.min(420, root.clientHeight * 0.4)), st = [[0].concat(secs[0].c, 0)];
    for (i = 1; i < secs.length; i++) {
      var A = secs[i - 1], B = secs[i], b = B.y, za = Math.min(ZONE, A.h / 2), zb = Math.min(ZONE, B.h / 2);
      if (same(A.c, B.c)) continue;
      var mid = [0, 1, 2].map(function (j) { return (A.c[j] + B.c[j]) / 2; });
      st.push([b - za].concat(A.c, 1), [b].concat(mid, 2), [b + zb].concat(B.c, 0));
      B.zTop = zb; A.zBot = za;
    }
    st.push([H].concat(secs[secs.length - 1].c, 0));
    stops = st;
    follow();
    // as luzes das seções e as sombras dos quadros, em pontos da página
    var feats = [];
    secs.forEach(function (S, si) {
      glowsOf(S.el, S.w, S.h, S.x, S.y).forEach(function (g) {
        feats.push({ g: g, own: si, cy: g.cy, x0: g.cx - g.rx * g.end, x1: g.cx + g.rx * g.end, y0: g.cy - g.ry * g.end, y1: g.cy + g.ry * g.end, rects: glowRects(g) });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(SHADED), function (el) {
      var raw = getComputedStyle(el).getPropertyValue('--shade').trim();
      if (!raw) return;
      var v = raw.split(/\s+/).map(parseFloat);
      if (v.length < 4 || v.some(function (x) { return !isFinite(x); }) || !(v[1] >= 0) || !(v[3] >= 0 && v[3] <= 1)) { warn('--shade', raw); return; }
      var b = pageBox(el);
      if (b.w < 1 || b.h < 1) return;
      var dy = v[0], s = Math.max(0.5, v[1] / 2), sp = v[2], cy = b.y + b.h / 2, own = 0;
      secs.forEach(function (S, si) { if (cy >= S.y) own = si; });
      var sd = { x0: b.x - sp, x1: b.x + b.w + sp, y0: b.y - sp + dy, y1: b.y + b.h + sp + dy, s: s, a: v[3], c: [0, 0, 0] };
      var box = { x0: sd.x0 - 3 * s, x1: sd.x1 + 3 * s, y0: sd.y0 - 3 * s, y1: sd.y1 + 3 * s };
      feats.push({ sd: sd, own: own, cy: cy, x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1, rects: [box] });
    });
    // cada seção: o ::before dela cobre a largura da página (ele começa na borda esquerda da tela)
    secs.forEach(function (S, si) {
      var t = target('sec', S.el);
      if (t.gx !== S.x || t.gw !== W) { t.gx = S.x; t.gw = W; S.el.style.setProperty('--bd-x', S.x + 'px'); S.el.style.setProperty('--bd-w', W + 'px'); }
      var ps = sectionPieces(S, si, feats, k, W), bg = 'rgb(' + S.c.join(', ') + ')';
      if (!ps.length && same(S.c, BG) && !t.on) return;              // nada a pintar (a abertura): a página aparece
      var zs = ps.filter(function (p) { return p.zone; }), bs = ps.filter(function (p) { return !p.zone; });
      t.want = { sig: ps.map(function (p) { return p.key; }).join('|') + '|' + bg, layers: zs.concat(bs), zones: zs, bands: bs, bg: bg };
      var u = urgency(S.y, S.y1);
      zs.forEach(function (p) { need(p.key, p.job, -0.6); });          // os tons de todas as seções primeiro (são pequenos)
      bs.forEach(function (p) { need(p.key, p.job, u); });
    });
    // a tira da página: na primeira vez, antes de tudo (as seções entram por cima dela); depois, sem pressa
    clearTimeout(bodyTimer);
    var bt = target('body', body);
    if (!bt.sig) planBody(k, H, -0.5);
    else bodyTimer = setTimeout(function () { try { planBody(k, H, 0.5); } catch (err) { if (window.console) console.warn('backdrop.js', err); } }, 250);
    // dentro dos quadros (a janela da abertura e o quadro da Workstation X); --glow-top: as luzes começam abaixo dessa altura
    INSIDE.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var w = el.offsetWidth, h = el.offsetHeight, cs = getComputedStyle(el);
      if (w < 4 || h < 4) return;
      var top = parseFloat(cs.getPropertyValue('--glow-top')) || 0;
      var job = tidyNums({ kind: 'img', w: Math.round(w * k), h: Math.round(h * k), k: Math.round(w * k) / w, x0: 0, y0: 0, ox: 0, oy: 0,
        base: color(cs.backgroundColor), glows: glowsOf(el, w, h - top, 0, top) });
      var key = JSON.stringify(job), t = target('in', el), b = pageBox(el);
      t.want = { sig: key, layers: [{ key: key, job: job, pos: '0 0', size: w + 'px ' + h + 'px', rep: 'no-repeat' }] };
      need(key, job, urgency(b.y, b.y + b.h));
    });
    sweep();
  }
  // a página, por baixo das seções: só os tons (aparece quando uma seção some ou entra devagar, na troca das abas).
  // Não tem pressa: espera a página parar de mudar.
  var bodyTimer = 0;
  function planBody(k, H, pri) {
    var bt = target('body', body), bl = [], rows = Math.ceil(H * k);
    for (var Y = 0; Y < rows; Y += MAXROWS) {
      var hh = Math.min(MAXROWS, rows - Y), job = { kind: 'img', w: TILE, h: hh, k: k, x0: 0, y0: Y / k, ox: 0, oy: Y, tone: tidyNums(toneFor(0, Y / k, (Y + hh) / k)) };
      bl.push({ key: JSON.stringify(job), job: job, pos: '0 ' + Y / k + 'px', size: TILE / k + 'px ' + hh / k + 'px', rep: 'repeat-x' });
    }
    bt.want = { sig: bl.map(function (p) { return p.key; }).join('|'), layers: bl };
    bl.forEach(function (p) { need(p.key, p.job, pri); });
    sweep();
  }
  // o que ninguém quer mais sai da fila do Worker; e troca o que já estiver pronto
  function sweep() {
    var wanted = {};
    targets.forEach(function (t) { if (t.want) t.want.layers.forEach(function (l) { wanted[l.key] = 1; }); });
    Object.keys(cache).forEach(function (key) { var e = cache[key]; if (e.st === 'wait' && !wanted[key]) { cancel(e.id); delete cache[key]; } });
    settle();
  }

  // ----- a barra do topo e a barra do navegador pegam o tom do que está embaixo delas -----
  function toneAt(y) {
    for (var i = 1; i < stops.length; i++) {
      if (y <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], t = b[0] > a[0] ? curve((y - a[0]) / (b[0] - a[0]), a[4]) : 1;
        return [1, 2, 3].map(function (j) { return a[j] + (b[j] - a[j]) * t; });
      }
    }
    return stops.length ? stops[stops.length - 1].slice(1, 4) : [20, 20, 20];
  }
  // y, vh, bh: a rolagem, a altura da janela e a da barra (na rolagem, lidas no evento; sem elas, lidas aqui)
  function follow(y, vh, bh) {
    if (!stops.length) return;
    if (y === undefined) { y = window.scrollY; vh = window.innerHeight; bh = bar ? bar.offsetHeight : 0; }
    var bg = 'rgb(' + toneAt(y + bh).map(Math.round).join(',') + ')';
    var mid = 'rgb(' + toneAt(y + vh / 2).map(function (v) { return Math.round(v / 4) * 4; }).join(',') + ')';
    if (bar && bg !== barNow) { barNow = bg; bar.style.setProperty('--bg', bg); }
    if (themeMeta && mid !== themeNow) { themeNow = mid; themeMeta.setAttribute('content', mid); }
  }
  // Na rolagem, as medidas são lidas no próprio evento (ele vem antes dos quadros, com o layout pronto) e a cor é escrita
  // no quadro. Antes, o quadro lia a rolagem, escrevia a cor e lia de novo, e os outros scripts do quadro (as abas, o pó)
  // liam depois dessa escrita: a cada leitura, o navegador refazia o estilo na hora.
  var followQueued = false, seen = [0, 0, 0];
  window.addEventListener('scroll', function () {
    seen = [window.scrollY, window.innerHeight, bar ? bar.offsetHeight : 0];
    if (!followQueued) { followQueued = true; requestAnimationFrame(function () { followQueued = false; follow(seen[0], seen[1], seen[2]); }); }
  }, { passive: true });

  // ----- quando olhar de novo: a página, uma seção ou um quadro mudou de tamanho, o zoom, o idioma, as fontes -----
  // (olhar é barato: só o que mudou de verdade é pintado de novo)
  var queued = false;
  function soon() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; plan(); }); } }
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(plan);   // depois do layout e antes de desenhar: o fundo acompanha no mesmo quadro
    ro.observe(body);
    SECTIONS.concat(INSIDE).forEach(function (s) { var el = document.querySelector(s.charAt(0) === '.' ? s : '#' + s); if (el) ro.observe(el); });
  }
  window.addEventListener('resize', soon);
  window.addEventListener('load', soon);
  document.addEventListener('langchange', soon);
  document.addEventListener('introdone', soon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
  (function onRatio() {                  // a janela foi para outra tela, com outra escala: a página não muda de tamanho
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    var h = function () { if (mq.removeEventListener) mq.removeEventListener('change', h); else mq.removeListener(h); soon(); onRatio(); };
    if (mq.addEventListener) mq.addEventListener('change', h); else mq.addListener(h);
  })();
  // a primeira pintura espera a página montar (os scripts depois deste ainda mexem nela)
  function start() { ready = true; plan(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // ----- o céu do estúdio 3D (js/studio.js) -----
  // o pedido: o tamanho do canvas em pixels, as duas cores do céu (o centro e a borda), o centro e o raio da luz, e a
  // sombra da baseplate (uma elipse que escurece em curva). A resposta é um ImageData do tamanho do canvas.
  window.HRBackdrop = {
    sky: function (o, cb) {
      post({ kind: 'rgba', w: o.w, h: o.h, k: 1, x0: 0, y0: 0, ox: 0, oy: 0, sky: { cx: o.cx, cy: o.cy, r: o.r, c0: o.c0, c1: o.c1 }, glows: o.shadow ? [o.shadow] : [] }, -1,
        function (res) { if (res && res.buf) cb(new ImageData(new Uint8ClampedArray(res.buf), res.w, res.h)); });
    },
    toneAt: function (y) { return toneAt(y); },
    // a máscara de ruído azul (64 x 64 limiares de 0 a 1), para quem pinta os próprios degradês (as luzes do jogo em js/studio.js)
    noise: function () { return noise(); }
  };
})();
