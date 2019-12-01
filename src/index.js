import React from 'react'
import stopwords from './stopwords'
import ReactDOM from 'react-dom'
import Autosuggest from 'react-autosuggest'
import AutosuggestHighlightMatch from "autosuggest-highlight/umd/match";
import AutosuggestHighlightParse from "autosuggest-highlight/umd/parse";
import axios from 'axios'
import {debounce} from 'throttle-debounce'
import packageJson from '../package.json';
import './styles.css'

class AutoComplete extends React.Component {
  INDEX = 'address';
  state = {
    queryStr: '',
    isHouseInQueryStr: false,
    streetList: [],
    streetHouseList: [],
    selectedStreet: '',
    selectedHouse: ''
  };
  sw = stopwords.split("\n");

  remove_stopwords(str, sw) {
    let res = []
    let words = str.split(' ')
    for (let i = 0; i < words.length; i++) {
      if (!sw.includes(words[i])) {
        res.push(words[i])
      }
    }
    res = res.join(' ');
    res = res.replace(/,/g, '');
    res = res.replace(/-/g, ' ');
    return (res)
  }

  // Сортируем улицу по номерам домов
  //TODO: Вынести метод в отдельный класс
  sortByHouseNumber(houseFirst, houseSecond) {
    let ax = [], bx = [];

    houseFirst.house.replace(/(\d+)|(\D+)/g, function (_, $1, $2) {
      ax.push([$1 || Infinity, $2 || ""])
    });
    houseSecond.house.replace(/(\d+)|(\D+)/g, function (_, $1, $2) {
      bx.push([$1 || Infinity, $2 || ""])
    });

    while (ax.length && bx.length) {
      let an = ax.shift();
      let bn = bx.shift();
      let nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
      if (nn) {
        return nn;
      }
    }

    return ax.length - bx.length;
  }

  sortByDistrict(addrOne, addrTwo) {
    if (addrOne.district < addrTwo.district) {
      return -1;
    }
    if (addrOne.district > addrTwo.district) {
      return 1;
    }
    return 0;
  }

  sortBySettlement(addrOne, addrTwo) {
    if (addrOne.settlement < addrTwo.settlement) {
      return -1;
    }
    if (addrOne.settlement > addrTwo.settlement) {
      return 1;
    }
    return 0;
  }

  sortByStreet(addrOne, addrTwo) {
    if (addrOne.street < addrTwo.street) {
      return -1;
    }
    if (addrOne.street > addrTwo.street) {
      return 1;
    }
    return 0;
  }

  componentWillMount() {
    this.onSuggestionsFetchRequested = debounce(
        500,
        this.onSuggestionsFetchRequested
    )
  }

  componentWillUnmount() {
    this.setState({streetList: []})
  }

  // Показываем адрес в input box'e при выборе из списка
  showSelectedAddressString = street => {
    console.group("Выбран:");
    if (street.district && street.district && street.street
        && street.settlement_type && street.settlement) {

      const streetAddr =
          street.district_type.toLowerCase() + " " + street.district.trim()
          + ", " + street.settlement_type + " " + street.settlement.trim()
          + ", " + street.street_type + " " + street.street;

      console.log(
          street.street_type + ' ' + street.street + ' д '
          + street.houseNum + ' к ' + street.houseBuild);
      console.log(street);

      console.log("%OStreet house list: ", this.state.streetList)
      this.setState({selectedStreet: street});
      console.groupEnd();
      return (
          (!street.house) ? (
              streetAddr
          ) : (streetAddr + ' ' + street.house)
      );
    }
  };

  // Выводим список найденых адресов в options list
  renderAddressList = (street, {query}) => {
    /*
    */
    if (!street.settlement || !street.street) {
      return ""
    }

    const streetNoHouse = street.district_type + " " +
        street.district + ", " +
        street.settlement_type + " " +
        street.settlement + ", " +
        street.street_type + " " + street.street;

    const streetWithHouse = street.district_type + " " +
        street.district + ", " +
        street.settlement_type + " " +
        street.settlement + ", " +
        street.street_type + " " + street.street + ' д ' + street.house;

    const streetAddress = (street.house) ? (streetWithHouse) : (streetNoHouse);

    const matches = AutosuggestHighlightMatch(streetAddress, query);
    const parts = AutosuggestHighlightParse(streetAddress, matches);

    return (
        (streetAddress) ? (
            <span>
      {parts.map((part, index) => {
        const className = part.highlight ? 'react-autosuggest__suggestion-match'
            : null;

        return (
            <span className={className} key={index}>
            {part.text}
          </span>
        );
      })}
    </span>
        ) : ""
    )
  };

  /**
   * Ввод адреса и сохранение номера дома
   * @param event
   * @param newQuery
   */
  onChange = (event, {newValue: newQuery}) => {
    this.setState({queryStr: newQuery});
  };

  onFocus = (e) => {
    this.setState({queryStr: '', selectedStreet: ''})
  };

  toTitleCase(str) {
    if (str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
    return str
  }

  /**
   * Поиск адреса
   * @param queryStr
   */
  onSuggestionsFetchRequested = ({value: queryStr}) => {

    if (queryStr.trim().length > 2) {

      console.log("* = = = = = = = = = = = = = = = = = = = = = = = *");
      console.group("Поиск по строке: " + "%c " + queryStr,
          "background:#1496BB;color:white;font-weight:bold;font-size:12px");

      let selectedHouse = (queryStr.match(/\d+/))
          ? (this.state.queryStr.match(/\d+/)) : "";

      // Устанавливаем номер дома
      this.setState({selectedHouse: selectedHouse});
      console.log("Номер дома: " + "%c" + selectedHouse,
          "font-size:13px;font-weight:bold");

      // Устанавливае признак выбора дома
      const isHasHouse = /\.*\s+\d+.*$/.test(queryStr);
      this.setState({isHouseInQueryStr: isHasHouse});

      // Если дом не выбран ищем по адресу набранному в строке
      console.log("%cПоиск по адресу набранному вручную: ",
          "font-size:12px;font-weight:bold");

      //Очищаем адрес от номера дома
      queryStr = queryStr.replace(/\s+\d+?.*/g, '').toLowerCase();

      //Очищаем адрес от типа адреса (сокр. г, ул, пр-кт)
      queryStr = this.remove_stopwords(queryStr, this.sw)

      console.log("Строка: " + "%c" + queryStr,
          "font-size:12px;font-weight:bold;color:green");

      // Выполняем запрос к базе
      // сортируем по районам, нас.пунктам и улицам
      /*
      1. Сначала по строке получаем из базы 10 совпавших записей
      2. Затем по ходу набора фильтруем  зтот список по совпадению со строкой
      3. При вводе номера у совпавшей улицы ищем набранный номер дома
      4. Сохраняем результат в структуре.

      При наборе каждых 2-x симолов на сервер отправляется запрос
       */
      axios
      .post('/' + this.INDEX + '/_search', {
        size: 10,
        query: {
          match: {
            'street_address_suggest': {
              'query': queryStr,
              'operator': 'and'
            }
          }
        },
        sort: ['_score', {district: 'asc'}, {settlement: 'asc'},
          {street: 'asc'}]
      })
      .then(query => {
        // Получаем результат запроса (10 записей из базы, которые матчатся с поисковой строкой)
        // и сохраняем его в street
        const street = query.data.hits.hits.map(s => s._source);
        // Добавляем в адрес поля для хранения номера дома
        // street.push({house: ''});

        let streetWithHouses = [];
        console.groupCollapsed("Поиск по индексу")
        // Если улица найдена, фильтруем результат по индексу
        if (street) {
          street
          .filter(street => {
            if (street.street_address_suggest) {
              let suggest = street.street_address_suggest;

              suggest = this.remove_stopwords(suggest, this.sw)
              console.log(
                  "Индекс: " + "%c " + suggest,
                  "background:#222;color:#bada55");
              console.log("запрос: " + "%c " + queryStr,
                  "background:green;color:white");
              if (suggest.indexOf(queryStr.trim()) > -1) {
                console.log("cовпадение:")
                console.log("%c" + suggest,
                    "background:#117A65;color:white;font-size:12px");
              } else {
                console.warn("%cне найдена.",
                    "background:#C02f1D;color:yellow");
              }
              // Возвращаем все записи которые совпали
              street = suggest.indexOf(
                  queryStr.trim()) > -1;
              return street;
            } else {
              return false
            }
          })
          // Дальше отбираем у улиц список домов у которых есть дома с нужным номем
          .map(street => {
            if (street.houses) {
              street.houses
              //Фильтр по дому
              .filter(h => {
                if (h.house_num) {
                  // Фильтруем по номеру дома
                  return h.house_num.indexOf(this.state.selectedHouse) > -1;
                }
              })
              // Получаем дом с нужным номером
              .map(h => {
                if (h.house_num) {

                  let houseNum =
                      (h.build_num) ? (h.house_num + "к"
                          + h.build_num) : (h.house_num);
                  let strNum =
                      (h.str_num) ? (h.str_num + "к"
                          + h.str_num) : (h.str_num);

                  let houseNumSuggest =
                      (h.build_num) ? (" " + h.house_num.trim() + "к"
                          + h.build_num.trim()) : (" " + h.house_num);
                  let houseBuild =
                      (h.build_num) ? (h.build_num.trim()) : ("");

                  // Сохраняем  все что нашли в структуре
                  streetWithHouses.push({
                    settlement: street.settlement,
                    street: street.off_name,
                    house: houseNum.trim(),
                    aoLevel: street.ao_level,
                    fiasCode: h.ao_guid,
                    kladrCode: street.plain_code + "00" + h.counter,
                    okato: h.okato,
                    oktmo: h.oktmo,
                    fnsCode: h.ifns_fl,
                    postalCode: h.postal_code,
                    district: street.district,
                    district_type: street.district_type.toLowerCase(),
                    settlement_type: street.settlement_type,
                    street_type: street.street_type,
                    streetAddressSuggest: street.street_address_suggest.trim()
                        + houseNumSuggest,
                    houseNum: h.house_num,
                    houseBuild: houseBuild,
                    houseStrNum: strNum,
                    houseList: street.houses.length
                  });
                }
              });
            }
          });
        }
        console.groupEnd();

        streetWithHouses = streetWithHouses.sort(this.sortByHouseNumber);
        streetWithHouses = streetWithHouses.sort(this.sortByDistrict);
        streetWithHouses = streetWithHouses.sort(this.sortBySettlement);
        streetWithHouses = streetWithHouses.sort(this.sortByStreet);

        // Выводим в консоли результат отобранных адресов c номерами домов
        if (streetWithHouses.length > 0) {
          console.log("%cАдрес найден:" + "%c " + streetWithHouses.length,
              "background:#F58B4C;color:white",
              "background:white;font-weight:bold");
          console.log("%O", streetWithHouses);
          this.state.streetList = streetWithHouses
        } else {
          console.log("%cАдрес не найден",
              "background:#9A2617;color:white;font-weight:bold");
          this.state.streetList = street
        }

        if (this.state.isHouseInQueryStr) {
          this.setState({streetList: streetWithHouses});
        } else {
          this.setState({streetList: street});
        }

        console.groupEnd();
        console.log("%c Поиск завершен.", "font-weight:bold")

      });
    }
  };

  onSuggestionsClearRequested = () => {
    this.setState({streetList: []})
  };

  render() {

    const {queryStr, streetList} = this.state;

    const inputProps = {
      placeholder: 'Введите адрес в свободной форме',
      value: queryStr,
      onChange: this.onChange,
      onFocus: this.onFocus
    };

    return (
        <div className="App">
          <div>
            <div>
              <div>
                <div>
                  <h5><label htmlFor="address-input">Город, улица, дом
                  </label>
                  </h5>
                  <Autosuggest id="address-input"
                               suggestions={streetList}
                               onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
                               onSuggestionsClearRequested={this.onSuggestionsClearRequested}
                               getSuggestionValue={
                                 this.showSelectedAddressString
                               }
                               renderSuggestion={this.renderAddressList}
                               inputProps={inputProps}
                  />

                  <div>
                    <div>
                      <div><label
                          className="sgt-granular_label">Индекс</label></div>
                      <div>
                        <input
                            type="text"
                            readOnly="readonly"
                            value={this.state.selectedStreet.postalCode}/></div>
                      <div>
                        <div><label
                            className="sgt-granular_label">Регион/Район</label>
                        </div>
                        <div><input
                            data-ref="region" type="text" readOnly="readonly"
                            className="sgt-granular_input"
                            value={(this.state.selectedStreet.district)
                                ? (this.toTitleCase(
                                    this.state.selectedStreet.district)) : ""}/>
                        </div>
                      </div>
                      <div>
                        <div><label
                            className="sgt-granular_label">Город / н.п.</label>
                        </div>
                        <div>
                          <input data-ref="city" type="text" readOnly="readonly"
                                 className="sgt-granular_input"
                                 value={(this.state.selectedStreet.settlement_type)
                                     ?
                                     (this.state.selectedStreet.settlement_type
                                         + " "
                                         + this.toTitleCase(
                                             this.state.selectedStreet.settlement))
                                     :
                                     (this.toTitleCase(
                                         this.state.selectedStreet.settlement))}/>
                          <div className="sgt-demo__additional">
                            центр региона
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div><label
                          className="sgt-granular_label">Улица</label></div>
                      <div><input
                          data-ref="street" type="text" readOnly="readonly"
                          className="sgt-granular_input"
                          value={(this.state.selectedStreet.street_type)
                              ? (this.state.selectedStreet.street_type + " "
                                  +
                                  this.state.selectedStreet.street) :
                              (this.state.selectedStreet.street)}/>
                        <div className="sgt-demo__additional">
                          Число домов на
                          улице:&nbsp;{this.state.selectedStreet.houseList}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div><label
                          className="sgt-granular_label">Дом</label></div>
                      <div><input
                          data-ref="house" type="text" readOnly="readonly"
                          className="sgt-granular_input"
                          value={(!this.state.selectedStreet.houseBuild)
                              ? (this.state.selectedStreet.houseNum)
                              : (this.state.selectedStreet.houseNum + " корпус "
                                  + this.state.selectedStreet.houseBuild)}/>
                      </div>
                    </div>
                    <div>

                      <div className="brave__additional">
                        <h5>Дополнительная информация</h5>
                        <p>
                          <b className="brave__label">Код ФИАС</b>
                          <div>
                            {this.state.selectedStreet.fiasCode}</div>
                        </p>
                        <p>
                          <b className="brave__label">Код КЛАДР</b>
                          <div>{this.state.selectedStreet.kladrCode}</div>
                        </p>
                        <p>
                          <b className="brave__label">Код ОКАТО</b>
                          <div>{this.state.selectedStreet.okato}</div>
                        </p>
                        <p>
                          <b className="brave__label">Код ОКТМО</b>
                          <div>{this.state.selectedStreet.oktmo}</div>
                        </p>
                        <p>
                          <b className="brave__label">Код налоговой</b>
                          <div>{this.state.selectedStreet.fnsCode}</div>
                        </p>
                        <p>
                          <b className="brave__label">Уровень по ФИАС</b>
                          <div>{this.state.selectedStreet.aoLevel}</div>
                        </p>
                      </div>
                    </div>

                  </div>
                  <div>
                    <div className="col-xs-12 align-right">
                      Сведения актуальны на 11.11.2019 -
                      Версия: {packageJson.version}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    )
  }
}

ReactDOM.render(<AutoComplete/>, document.getElementById('root'));

