import React from 'react'
import ReactDOM from 'react-dom'
import Autosuggest from 'react-autosuggest'
import axios from 'axios'
import {debounce} from 'throttle-debounce'
import packageJson from '../package.json';
import './styles.css'

class AutoComplete extends React.Component {
  state = {
    queryStr: '',
    isHouseInQueryStr: false,
    streetList: [],
    selectedStreet: '',
    selectedHouse: ''
  };

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
          + street.houseNum + 'к' + street.houseBuild);
      console.log(street);
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
  renderAddressList = street => {
    if (!street.settlement || !street.street) {
      return ""
    }

    const streetAddress = (
        <div className="result">
          <span>{street.district_type}&nbsp;</span>
          <span>{street.district + ","}&nbsp;</span>
          <span>{street.settlement_type}&nbsp;</span>
          <span>{street.settlement + ","}&nbsp;</span>
          <span>{street.street_type}&nbsp;</span>
          {(street.house) ? (
                  <span>{street.street + ' д ' + street.house}&nbsp;</span>)
              : (<span>{street.street}&nbsp;</span>)}
        </div>
    );

    return (
        (streetAddress) ? (streetAddress) : ""
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

  /**
   * Поиск адреса
   * @param queryStr
   */
  onSuggestionsFetchRequested = ({value: queryStr}) => {
    if (queryStr.trim().length > 2) {

      console.log("* = = = = = = = = = = = = = = = = = = = = = = = *");
      console.group("Поиск по строке: " + "%c " + queryStr,
          "background:#1496BB;color:white;font-weight:bold;font-size:12px")

      let selectedHouse = (queryStr.match(/\d+/))
          ? (this.state.queryStr.match(/\d+/)) : "";

      // Устанавливаем номер дома
      this.setState({selectedHouse: selectedHouse});
      console.log("Номер дома: " + "%c" + selectedHouse,
          "font-size:13px;font-weight:bold");

      // Устанавливае признак выбора дома
      const isHasHouse = /\.*\s+\d+.*$/.test(queryStr);
      this.setState({isHouseInQueryStr: isHasHouse});


      console.log("%cПоиск по адресу набранному вручную: ",
          "font-size:12px;font-weight:bold");
      //Очищаем адрес от номера дома
      queryStr = queryStr.replace(/\s+\d+?.*/g, '').toLowerCase();
      //Очищаем адрес от типа адреса (сокр. г, ул, пр-кт)
      queryStr = queryStr.replace(/респ\s+/g, '');
      queryStr = queryStr.replace(/проезд+/g, '')
      queryStr = queryStr.replace(/г\s+/g, '');
      queryStr = queryStr.replace(/рп\s+/g, '')
      queryStr = queryStr.replace(/р-н\s+/g, '')
      queryStr = queryStr.replace(/д\s+/g, '')
      queryStr = queryStr.replace(/c\s+/g, '')
      queryStr = queryStr.replace(/с\s+/g, '')
      queryStr = queryStr.replace(/п\s+/g, '')
      queryStr = queryStr.replace(/ст\s+/g, '')
      queryStr = queryStr.replace(/ул\s+/g, '')
      queryStr = queryStr.replace(/пер\s+/g, '')
      queryStr = queryStr.replace(/пр-кт\s+/g, '')
      queryStr = queryStr.replace(/,/g, " ")
      queryStr = queryStr.replace(/ +(?= )/g, '')


      console.log("Строка: " + "%c" + queryStr,
          "font-size:12px;font-weight:bold;color:green");
      // }

      // Выполняем запрос к базе
      // сортируем по районам, нас.пунктам и улицам
      axios
      .post('/fias_addr_suggest/_search', {
        size: 10,
        query: {
          match: {
            'street_address_suggest': queryStr
          }
        },
        sort: ['_score', {district: 'asc'}, {settlement: 'asc'},
          {street: 'asc'}]
      })
      .then(query => {
        // Получаем результат запроса
        const street = query.data.hits.hits.map(h => h._source);
        // Добавляем в адрес поля для хранения номера дома
        street.push({house: ''});

        // Сортируем улицу по номерам домов
        //TODO: Вынести метод в отдельный класс
        function sortByHouseNumber(houseFirst, houseSecond) {
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

        let addrSortByStreet = [];

        console.groupCollapsed("Поиск по индексу")
        if (street) {
          street
          // Фильтруем по индексу
          .filter(street => {
            console.log("Индекс: " + "%c " + street.street_address_suggest,
                "background:#222;color:#bada55");
            console.log("Строка: " + "%c " + queryStr,
                "background:green;color:white");
            if (street.street_address_suggest) {
              if (street.street_address_suggest.toLowerCase().indexOf(
                  queryStr.trim()) > -1) {
                console.log("%cНайдена: ",
                    "background:#C02f1D;color:white;font-size:12px");
              } else {
                console.warn("%cНе найдена.",
                    "background:#C02f1D;color:yellow");
              }
              return street.street_address_suggest.toLowerCase().indexOf(
                  queryStr.trim()) > -1;
            } else {
              return false
            }
          })
          .map(street => {
            if (street.houses) {
              street.houses
              .filter(it => {
                if (it.house_num) {
                  // Фильтруем по номеру дома
                  return it.house_num.indexOf(this.state.selectedHouse) > -1;
                }
              })
              .map(house => {
                if (house.house_num) {

                  let houseNum =
                      (house.build_num) ? (house.house_num + "к"
                          + house.build_num) : (house.house_num);
                  let houseNumSuggest =
                      (house.build_num) ? (" " + house.house_num.trim() + "к"
                          + house.build_num.trim()) : (" " + house.house_num);
                  let houseBuild =
                      (house.build_num) ? (house.build_num.trim()) : ("");

                  addrSortByStreet.push({
                    settlement: street.settlement,
                    street: street.street,
                    house: houseNum.trim(),
                    aoLevel: street.ao_level,
                    fiasCode: house.house_guid,
                    kladrCode: street.plain_code + "00" + house.counter,
                    okato: house.okato,
                    oktmo: house.oktmo,
                    fnsCode: house.ifns_fl,
                    postalCode: house.postal_code,
                    district: street.district,
                    district_type: street.district_type.toLowerCase(),
                    settlement_type: street.settlement_type,
                    street_type: street.street_type,
                    streetAddressSuggest: street.street_address_suggest.trim()
                        + houseNumSuggest,
                    houseNum: house.house_num,
                    houseBuild: houseBuild,
                    houseList: street.houses.length
                  });
                }
              });
            }
          });
        }
        console.groupEnd();
        addrSortByStreet = addrSortByStreet.sort(sortByHouseNumber);

        function sortByDistrict(addrOne, addrTwo) {
          if (addrOne.district < addrTwo.district) {
            return -1;
          }
          if (addrOne.district > addrTwo.district) {
            return 1;
          }
          return 0;
        }

        function sortBySettlement(addrOne, addrTwo) {
          if (addrOne.settlement < addrTwo.settlement) {
            return -1;
          }
          if (addrOne.settlement > addrTwo.settlement) {
            return 1;
          }
          return 0;
        }

        function sortByStreet(addrOne, addrTwo) {
          if (addrOne.street < addrTwo.street) {
            return -1;
          }
          if (addrOne.street > addrTwo.street) {
            return 1;
          }
          return 0;
        }

        addrSortByStreet = addrSortByStreet.sort(sortByDistrict);
        addrSortByStreet = addrSortByStreet.sort(sortBySettlement);
        addrSortByStreet = addrSortByStreet.sort(sortByStreet);

        if (addrSortByStreet.length > 0) {
          console.log("%cНайден:" + "%c " + addrSortByStreet.length,
              "background:#F58B4C;color:white",
              "background:white;font-weight:bold");
          console.log("%O", addrSortByStreet);
        } else {
          console.log("%cНе найден",
              "background:#9A2617;color:white;font-weight:bold");
        }

        if (this.state.isHouseInQueryStr) {
          this.setState({streetList: addrSortByStreet});
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
                            className="sgt-granular_label">Регион</label>
                        </div>
                        <div><input type="text" readOnly="readonly"
                                    className="sgt-granular_input"
                                    value={"респ Мордовия"}/>
                          <div data-ref="federal-district"
                               className="sgt-demo__additional">Приволжский фед.
                            округ
                          </div>
                        </div>
                      </div>
                      <div>
                        <div><label
                            className="sgt-granular_label">Район</label>
                        </div>
                        <div><input
                            data-ref="region" type="text" readOnly="readonly"
                            className="sgt-granular_input"
                            value={(this.state.selectedStreet.district !== 'Мордовия')
                                ? (this.state.selectedStreet.district) : ""}/>
                        </div>
                      </div>
                      <div>
                        <div><label
                            className="sgt-granular_label">Город / н.п.</label>
                        </div>
                        <div>
                          <input data-ref="city" type="text" readOnly="readonly"
                                 className="sgt-granular_input"
                                 value={(this.state.selectedStreet.settlement_type) ?
                                     (this.state.selectedStreet.settlement_type + " "
                                         + this.state.selectedStreet.settlement) :
                                     (this.state.selectedStreet.settlement)}/>
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
                                  + this.state.selectedStreet.street) :
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
                      <div data-ref="additional" className="additional-info">
                        <p>Дополнительная информация:</p>
                        <table>
                          <tbody>

                          <tr>
                            <td>Уровень по ФИАС</td>
                            <td data-ref="fias-level">{this.state.selectedStreet.aoLevel}</td>
                          </tr>
                          <tr>
                            <td>Код ФИАС</td>
                            <td data-ref="fias-codes"> {this.state.selectedStreet.fiasCode}
                            </td>
                          </tr>
                          <tr>
                            <td>Код КЛАДР</td>
                            <td data-ref="kladr-id">{this.state.selectedStreet.kladrCode}</td>
                          </tr>
                          <tr>
                            <td>Код ОКАТО</td>
                            <td data-ref="okato">{this.state.selectedStreet.okato}</td>
                          </tr>
                          <tr>
                            <td>Код ОКТМО</td>
                            <td data-ref="oktmo">{this.state.selectedStreet.oktmo}</td>
                          </tr>
                          <tr>
                            <td>Код ИФНС</td>
                            <td data-ref="tax-office">{this.state.selectedStreet.fnsCode}</td>
                          </tr>
                          </tbody>
                        </table>
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

