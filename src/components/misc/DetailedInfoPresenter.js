import React, { Component } from 'react';
import {
  View,
  Image,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import SafeAreaView from 'react-native-safe-area-view';

import GLOBALS from 'src/Globals';

export default class DetailedInfoPresenter extends Component {
  // CONSTRUCTOR
  constructor(props) {
    super(props);

    this.state = {
      y: 0,
      ay: new Animated.Value(0),
      fader: new Animated.Value(0),
    }
  }

  // COMPONENT UPDATED
  componentDidUpdate(prevProps) {
    if (this.props.animated == true && this.props.startAnimation !== prevProps.startAnimation) {
      this.showMessage(this.props.animationCompleteCallback);
    }
  }

  // VIEW RELATED
  findDimensions = (layout) => {
    const {height} = layout;
    const halfH = height/2;

    this.setState({
      y: halfH,
    }, () => {
      Animated.timing(this.state.ay, {
        toValue: halfH,
      	duration: 0,
        useNativeDriver: true,
      }).start();
    });
  }

  // FUNCTIONS
  showMessage = (afterCallback) => {
    Animated.parallel([
      Animated.timing(this.state.ay, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(this.state.fader, {
      		toValue: 1,
          easing: Easing.linear,
      		duration: 250,
          useNativeDriver: true,
      	})
      ])
    ]).start(() => {
      if (afterCallback) {
        afterCallback();
      }
    });
  }

  // RENDER
  render() {
    const {
      style,
      icon,
      contentView,
      animated
    } = this.props;

    let logoStyle = {};
    let contentStyle = {};

    if (animated) {
      logoStyle = {
        transform: [{ translateY: this.state.ay }]
      }

      contentStyle = {opacity: this.state.fader}
    }

    return (
      <View style={[ styles.container, style ]}>

        <Animated.View
          style={[
            styles.logo,
            logoStyle,
          ]}
        >
          <Image
            style={styles.icon}
            source={icon}
          />
        </Animated.View>

        <Animated.View
          style={[ styles.content, contentStyle ]}
          onLayout={(event) => { this.findDimensions(event.nativeEvent.layout) }}
        >
          {contentView}
        </Animated.View>
      </View>
    );
  }
}

// Styling
const styles = StyleSheet.create({
  container: {
    width: '100%',

    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    paddingVertical: 10,

    justifyContent: 'center',
    alignItems: 'center',
  }
});
